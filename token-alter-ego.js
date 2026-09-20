const MODULE_ID = "token-alter-ego";
const MODULE_VERSION = "1.1.1";
const FLAG_IDENTITIES = "identities";
const FLAG_CURRENT = "currentIdentity";
const FLAG_IDENTITIES_CACHE = "identitiesCache";
const SOCKET_NAME = `module.${MODULE_ID}`;

function getRootElement(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  return null;
}

function getTokenDocument(hud) {
  return hud?.document ?? hud?.object?.document ?? null;
}

function getActor(hud, tokenDocument) {
  return hud?.actor ?? hud?.object?.actor ?? tokenDocument?.actor ?? null;
}

function getPersistentActor(actor, tokenDocument) {
  // For unlinked tokens, tokenDocument.actor is a synthetic Actor. Store the
  // shared identity configuration on the world-level base Actor so it survives
  // scene reloads and is available to every token representing that Actor.
  return tokenDocument?.baseActor ?? actor ?? null;
}

function getIdentityData(actor, tokenDocument) {
  const persistentActor = getPersistentActor(actor, tokenDocument);

  // v1.1.1 storage: the base Actor is authoritative.
  const persistent = persistentActor?.getFlag?.(MODULE_ID, FLAG_IDENTITIES);
  if (persistent) return persistent;

  // Legacy fallback for configurations written to a synthetic Token Actor by
  // earlier versions. This lets a GM open and re-save them to migrate them.
  if (actor && actor !== persistentActor) {
    const legacy = actor.getFlag?.(MODULE_ID, FLAG_IDENTITIES);
    if (legacy) return legacy;
  }

  // Per-token cache is a final fallback and protects placed-token configuration
  // from systems which replace/rebuild synthetic Actors during a reload.
  return tokenDocument?.getFlag?.(MODULE_ID, FLAG_IDENTITIES_CACHE) ?? null;
}

function userCanToggle(tokenDocument, actor, user = game.user) {
  if (!user || !tokenDocument) return false;
  if (user.isGM) return true;

  // When checking the current client, the convenient isOwner accessors are
  // reliable and inexpensive. For remote users, use document permission tests.
  if (user.id === game.user.id) {
    return Boolean(tokenDocument.isOwner || actor?.isOwner || tokenDocument.baseActor?.isOwner);
  }

  try {
    return Boolean(
      tokenDocument.testUserPermission?.(user, "OWNER") ||
      actor?.testUserPermission?.(user, "OWNER") ||
      tokenDocument.baseActor?.testUserPermission?.(user, "OWNER")
    );
  } catch (_error) {
    return false;
  }
}

function isConfigured(identities) {
  return Boolean(
    identities?.a?.img &&
    identities?.b?.img &&
    identities?.a?.name?.trim() &&
    identities?.b?.name?.trim()
  );
}

function normalizeDimension(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function currentIdentityForToken(tokenDocument, identities) {
  const stored = tokenDocument?.getFlag(MODULE_ID, FLAG_CURRENT);
  if (stored === "a" || stored === "b") return stored;

  const currentName = tokenDocument?.name ?? "";
  const currentImg = tokenDocument?.texture?.src ?? "";

  if (identities?.b?.name === currentName && identities?.b?.img === currentImg) return "b";
  return "a";
}

async function toggleIdentity(tokenDocument, actor) {
  if (!tokenDocument || !actor) return;

  const identities = getIdentityData(actor, tokenDocument);
  if (!isConfigured(identities)) {
    ui.notifications.warn("Token Alter Ego: This Actor does not have two identities configured yet.");
    return;
  }

  if (!userCanToggle(tokenDocument, actor)) {
    ui.notifications.warn("Token Alter Ego: You do not own this token or Actor.");
    return;
  }

  // GMs can perform the document update directly. Player requests are routed
  // through the active GM so the feature still works when Foundry's separate
  // Configure Token Settings permission is disabled for the player's role.
  if (!game.user.isGM) {
    const activeGM = getPrimaryActiveGM();
    if (!activeGM) {
      ui.notifications.warn("Token Alter Ego: A GM must be connected for a player to change identities.");
      return;
    }

    game.socket.emit(SOCKET_NAME, {
      action: "toggle",
      sceneId: tokenDocument.parent?.id ?? canvas?.scene?.id,
      tokenId: tokenDocument.id,
      userId: game.user.id
    });
    return;
  }

  await performIdentityUpdate(tokenDocument, identities);
}

async function performIdentityUpdate(tokenDocument, identities) {
  const current = currentIdentityForToken(tokenDocument, identities);
  const nextKey = current === "a" ? "b" : "a";
  const next = identities[nextKey];

  try {
    await tokenDocument.update({
      name: next.name.trim(),
      "texture.src": next.img,
      width: normalizeDimension(next.width),
      height: normalizeDimension(next.height),
      [`flags.${MODULE_ID}.${FLAG_CURRENT}`]: nextKey
    });
  } catch (error) {
    console.error(`${MODULE_ID} | Failed to toggle identity`, error);
    ui.notifications.error("Token Alter Ego: Could not change this token. Check the browser console (F12) for details.");
  }
}

function getPrimaryActiveGM() {
  return game.users
    ?.filter?.((user) => user.active && user.isGM)
    ?.sort?.((a, b) => String(a.id).localeCompare(String(b.id)))
    ?.[0] ?? null;
}

async function handleSocketMessage(message) {
  if (!game.user.isGM || message?.action !== "toggle") return;

  // Only one active GM handles a player's request, preventing a double-toggle
  // when multiple GMs are logged in.
  const primaryGM = getPrimaryActiveGM();
  if (!primaryGM || primaryGM.id !== game.user.id) return;

  const requester = game.users.get(message.userId);
  const scene = game.scenes.get(message.sceneId);
  const tokenDocument = scene?.tokens?.get(message.tokenId);
  const actor = tokenDocument?.actor ?? null;
  if (!requester || !tokenDocument || !actor) return;

  if (!userCanToggle(tokenDocument, actor, requester)) {
    console.warn(`${MODULE_ID} | Rejected identity toggle from non-owner ${requester.name}`);
    return;
  }

  const identities = getIdentityData(actor, tokenDocument);
  if (!isConfigured(identities)) return;
  await performIdentityUpdate(tokenDocument, identities);
}

function buildIdentityEditor(actor, tokenDocument) {
  const saved = getIdentityData(actor, tokenDocument) ?? {};
  const tokenName = tokenDocument?.name ?? actor?.prototypeToken?.name ?? actor?.name ?? "Identity A";
  const tokenImg = tokenDocument?.texture?.src ?? actor?.prototypeToken?.texture?.src ?? actor?.img ?? "";

  const values = {
    a: {
      name: saved?.a?.name ?? tokenName,
      img: saved?.a?.img ?? tokenImg,
      width: normalizeDimension(saved?.a?.width),
      height: normalizeDimension(saved?.a?.height)
    },
    b: {
      name: saved?.b?.name ?? "",
      img: saved?.b?.img ?? "",
      width: normalizeDimension(saved?.b?.width),
      height: normalizeDimension(saved?.b?.height)
    }
  };

  const wrapper = document.createElement("div");
  wrapper.className = "token-alter-ego-editor";
  wrapper.innerHTML = `
    <p class="notes">
      Configure the two identities used by this Actor. Toggling changes the placed token's displayed name, artwork, width, and height.
    </p>
    <div class="tae-identity-grid">
      <section class="tae-identity-card" data-identity="a">
        <h3><i class="fa-solid fa-user"></i> Identity A</h3>
        <img class="tae-preview" alt="Identity A preview">
        <div class="form-group">
          <label>Name shown on token</label>
          <input type="text" data-field="name" autocomplete="off">
        </div>
        <div class="form-group">
          <label>Token artwork</label>
          <div class="form-fields tae-image-field">
            <input type="text" data-field="img" autocomplete="off">
            <button type="button" data-action="browse" title="Browse Files">
              <i class="fa-solid fa-file-import"></i>
            </button>
          </div>
        </div>
        <div class="tae-size-fields">
          <div class="form-group">
            <label>Width (grid spaces)</label>
            <input type="number" data-field="width" min="0.25" step="0.25">
          </div>
          <div class="form-group">
            <label>Height (grid spaces)</label>
            <input type="number" data-field="height" min="0.25" step="0.25">
          </div>
        </div>
      </section>
      <section class="tae-identity-card" data-identity="b">
        <h3><i class="fa-solid fa-mask"></i> Identity B</h3>
        <img class="tae-preview" alt="Identity B preview">
        <div class="form-group">
          <label>Name shown on token</label>
          <input type="text" data-field="name" autocomplete="off">
        </div>
        <div class="form-group">
          <label>Token artwork</label>
          <div class="form-fields tae-image-field">
            <input type="text" data-field="img" autocomplete="off">
            <button type="button" data-action="browse" title="Browse Files">
              <i class="fa-solid fa-file-import"></i>
            </button>
          </div>
        </div>
        <div class="tae-size-fields">
          <div class="form-group">
            <label>Width (grid spaces)</label>
            <input type="number" data-field="width" min="0.25" step="0.25">
          </div>
          <div class="form-group">
            <label>Height (grid spaces)</label>
            <input type="number" data-field="height" min="0.25" step="0.25">
          </div>
        </div>
      </section>
    </div>
    <p class="notes tae-footnote">
      The Actor itself is not renamed. Statistics, hit points, effects, initiative, ownership, vision, and token position are not changed. Size changes expand or shrink from the token's current top-left grid position.
    </p>
  `;

  for (const key of ["a", "b"]) {
    const card = wrapper.querySelector(`[data-identity="${key}"]`);
    const nameInput = card.querySelector('[data-field="name"]');
    const imgInput = card.querySelector('[data-field="img"]');
    const widthInput = card.querySelector('[data-field="width"]');
    const heightInput = card.querySelector('[data-field="height"]');
    const preview = card.querySelector(".tae-preview");

    // DialogV2 v13 expects string content (or a bare attribute-free element).
    // We build with the DOM for safe value assignment, then serialize to HTML.
    nameInput.setAttribute("value", values[key].name);
    imgInput.setAttribute("value", values[key].img);
    widthInput.setAttribute("value", String(values[key].width));
    heightInput.setAttribute("value", String(values[key].height));
    preview.setAttribute("src", values[key].img || "icons/svg/mystery-man.svg");
  }

  return wrapper.outerHTML;
}

function getDialogContentRoot(dialog) {
  return dialog?.element?.querySelector?.(".token-alter-ego-editor") ?? dialog?.element ?? null;
}

function wireConfigurationDialog(dialog) {
  const content = getDialogContentRoot(dialog);
  if (!content) return;

  for (const key of ["a", "b"]) {
    const card = content.querySelector(`[data-identity="${key}"]`);
    if (!card) continue;

    const imgInput = card.querySelector('[data-field="img"]');
    const preview = card.querySelector(".tae-preview");
    if (!imgInput || !preview) continue;

    imgInput.addEventListener("input", () => {
      preview.src = imgInput.value.trim() || "icons/svg/mystery-man.svg";
    });
  }

  content.querySelectorAll('button[data-action="browse"]').forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const card = button.closest(".tae-identity-card");
      const input = card?.querySelector('[data-field="img"]');
      const preview = card?.querySelector(".tae-preview");
      if (!input || !preview) return;

      try {
        const FilePickerClass = foundry?.applications?.apps?.FilePicker ?? globalThis.FilePicker;
        if (!FilePickerClass) throw new Error("Foundry FilePicker class was not found.");

        const picker = new FilePickerClass({
          type: "image",
          current: input.value,
          callback: (path) => {
            input.value = path;
            preview.src = path || "icons/svg/mystery-man.svg";
            input.dispatchEvent(new Event("input", { bubbles: true }));
          }
        });

        // V13 FilePicker is ApplicationV2. Browse first so the requested path is prepared,
        // then render the picker as a normal Foundry application.
        await picker.browse(input.value || "");
        picker.render(true);
      } catch (error) {
        console.error(`${MODULE_ID} | Failed to open File Picker`, error);
        ui.notifications.error("Token Alter Ego: Could not open Foundry's file picker. Check F12 for details.");
      }
    });
  });
}

function readEditorValues(content) {
  const read = (key, field) => content
    ?.querySelector(`[data-identity="${key}"] [data-field="${field}"]`)
    ?.value
    ?.trim() ?? "";

  return {
    a: {
      name: read("a", "name"),
      img: read("a", "img"),
      width: normalizeDimension(read("a", "width")),
      height: normalizeDimension(read("a", "height"))
    },
    b: {
      name: read("b", "name"),
      img: read("b", "img"),
      width: normalizeDimension(read("b", "width")),
      height: normalizeDimension(read("b", "height"))
    }
  };
}

async function openConfiguration(actor, tokenDocument) {
  if (!game.user.isGM) {
    ui.notifications.warn("Token Alter Ego: Only a GM can configure identities.");
    return;
  }

  if (!actor) {
    ui.notifications.warn("Token Alter Ego: No Actor is associated with this token.");
    return;
  }

  try {
    const DialogV2 = foundry?.applications?.api?.DialogV2;
    if (!DialogV2) throw new Error("Foundry DialogV2 class was not found.");

    const content = buildIdentityEditor(actor, tokenDocument);

    const result = await DialogV2.wait({
      window: { title: `Token Alter Ego — ${actor.name}` },
      content,
      // Keep the dialog non-modal so Foundry's FilePicker can open above it normally.
      modal: false,
      render: (_event, dialog) => wireConfigurationDialog(dialog),
      buttons: [
        {
          action: "clear",
          label: "Clear",
          icon: "fa-solid fa-trash",
          callback: async () => ({ action: "clear" })
        },
        {
          action: "cancel",
          label: "Cancel",
          icon: "fa-solid fa-xmark",
          callback: async () => ({ action: "cancel" })
        },
        {
          action: "save",
          label: "Save Identities",
          icon: "fa-solid fa-floppy-disk",
          default: true,
          callback: async (_event, _button, dialog) => ({
            action: "save",
            identities: readEditorValues(getDialogContentRoot(dialog))
          })
        }
      ]
    });

    if (!result || result.action === "cancel") return;

    if (result.action === "clear") {
      const persistentActor = getPersistentActor(actor, tokenDocument);
      await persistentActor?.unsetFlag(MODULE_ID, FLAG_IDENTITIES);
      if (actor && actor !== persistentActor) {
        try { await actor.unsetFlag(MODULE_ID, FLAG_IDENTITIES); } catch (_error) {}
      }
      if (tokenDocument?.getFlag(MODULE_ID, FLAG_IDENTITIES_CACHE)) {
        await tokenDocument.unsetFlag(MODULE_ID, FLAG_IDENTITIES_CACHE);
      }
      if (tokenDocument?.getFlag(MODULE_ID, FLAG_CURRENT)) {
        await tokenDocument.unsetFlag(MODULE_ID, FLAG_CURRENT);
      }
      ui.notifications.info(`Token Alter Ego: Cleared identities for ${actor.name}.`);
      return;
    }

    if (!isConfigured(result.identities)) {
      ui.notifications.warn("Token Alter Ego: Both identities need a name and token image.");
      return;
    }

    const persistentActor = getPersistentActor(actor, tokenDocument);
    if (!persistentActor) throw new Error("No persistent base Actor was available for identity storage.");

    // Save shared configuration to the base Actor and keep a placed-token cache
    // as a fallback. This survives reloads and works for linked and unlinked tokens.
    await persistentActor.setFlag(MODULE_ID, FLAG_IDENTITIES, result.identities);
    if (tokenDocument) {
      await tokenDocument.setFlag(MODULE_ID, FLAG_IDENTITIES_CACHE, result.identities);
      const detected = currentIdentityForToken(tokenDocument, result.identities);
      await tokenDocument.setFlag(MODULE_ID, FLAG_CURRENT, detected);
    }

    ui.notifications.info(`Token Alter Ego: Saved identities for ${actor.name}.`);
  } catch (error) {
    console.error(`${MODULE_ID} | Failed to open or save configuration`, error);
    ui.notifications.error("Token Alter Ego: Configuration failed to open. Press F12 and check the Console for the Token Alter Ego error.");
  }
}

function makeHudControl({ icon, title, className, onClick }) {
  const control = document.createElement("div");
  control.className = `control-icon token-alter-ego-control ${className}`;
  control.setAttribute("role", "button");
  control.setAttribute("tabindex", "0");
  control.setAttribute("aria-label", title);
  control.title = title;
  control.innerHTML = `<i class="${icon}"></i>`;

  const activate = (event) => {
    event.preventDefault();
    event.stopPropagation();

    try {
      const result = onClick(event);
      if (result?.catch) {
        result.catch((error) => {
          console.error(`${MODULE_ID} | HUD action failed`, error);
          ui.notifications.error("Token Alter Ego: The HUD action failed. Press F12 and check the Console for details.");
        });
      }
    } catch (error) {
      console.error(`${MODULE_ID} | HUD action failed`, error);
      ui.notifications.error("Token Alter Ego: The HUD action failed. Press F12 and check the Console for details.");
    }
  };

  control.addEventListener("click", activate);
  control.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") activate(event);
  });
  return control;
}

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing Token Alter Ego v${MODULE_VERSION}`);
});

Hooks.once("ready", () => {
  game.socket.on(SOCKET_NAME, handleSocketMessage);
});

Hooks.on("renderTokenHUD", (hud, html) => {
  const root = getRootElement(html);
  const tokenDocument = getTokenDocument(hud);
  const actor = getActor(hud, tokenDocument);

  if (!root || !tokenDocument || !actor) return;

  root.querySelectorAll(".token-alter-ego-control").forEach((el) => el.remove());

  const identities = getIdentityData(actor, tokenDocument);
  const canToggle = userCanToggle(tokenDocument, actor);
  const targetColumn = root.querySelector(".col.right")
    ?? root.querySelector(".right")
    ?? root.querySelector(".col.left")
    ?? root;

  if (isConfigured(identities) && canToggle) {
    const current = currentIdentityForToken(tokenDocument, identities);
    const next = current === "a" ? identities.b : identities.a;
    const toggle = makeHudControl({
      icon: "fa-solid fa-repeat",
      title: `Change identity to ${next.name}`,
      className: "token-alter-ego-toggle",
      onClick: () => toggleIdentity(tokenDocument, actor)
    });
    targetColumn.append(toggle);
  }

  if (game.user.isGM) {
    const configure = makeHudControl({
      icon: "fa-solid fa-user-pen",
      title: "Configure Token Alter Ego",
      className: "token-alter-ego-configure",
      onClick: () => openConfiguration(actor, tokenDocument)
    });
    targetColumn.append(configure);
  }
});
