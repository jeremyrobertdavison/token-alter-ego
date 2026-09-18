const MODULE_ID = "token-alter-ego";
const FLAG_IDENTITIES = "identities";
const FLAG_CURRENT = "currentIdentity";

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

function getIdentityData(actor) {
  return actor?.getFlag(MODULE_ID, FLAG_IDENTITIES) ?? null;
}

function isConfigured(identities) {
  return Boolean(
    identities?.a?.img &&
    identities?.b?.img &&
    identities?.a?.name?.trim() &&
    identities?.b?.name?.trim()
  );
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

  const identities = getIdentityData(actor);
  if (!isConfigured(identities)) {
    ui.notifications.warn("Token Alter Ego: This Actor does not have two identities configured yet.");
    return;
  }

  if (!game.user.isGM && !tokenDocument.isOwner) {
    ui.notifications.warn("Token Alter Ego: You do not have permission to change this token.");
    return;
  }

  const current = currentIdentityForToken(tokenDocument, identities);
  const nextKey = current === "a" ? "b" : "a";
  const next = identities[nextKey];

  try {
    await tokenDocument.update({
      name: next.name.trim(),
      "texture.src": next.img,
      [`flags.${MODULE_ID}.${FLAG_CURRENT}`]: nextKey
    });
  } catch (error) {
    console.error(`${MODULE_ID} | Failed to toggle identity`, error);
    ui.notifications.error("Token Alter Ego: Could not change this token. Check the console for details.");
  }
}

function buildIdentityEditor(actor, tokenDocument) {
  const saved = getIdentityData(actor) ?? {};
  const tokenName = tokenDocument?.name ?? actor?.prototypeToken?.name ?? actor?.name ?? "Identity A";
  const tokenImg = tokenDocument?.texture?.src ?? actor?.prototypeToken?.texture?.src ?? actor?.img ?? "";

  const values = {
    a: {
      name: saved?.a?.name ?? tokenName,
      img: saved?.a?.img ?? tokenImg
    },
    b: {
      name: saved?.b?.name ?? "",
      img: saved?.b?.img ?? ""
    }
  };

  const wrapper = document.createElement("div");
  wrapper.className = "token-alter-ego-editor";
  wrapper.innerHTML = `
    <p class="notes">
      Configure the two names and token images used by this Actor. Toggling changes only the placed token's displayed name and artwork.
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
            <button type="button" class="file-picker" data-action="browse" title="Browse Files">
              <i class="fa-solid fa-file-import"></i>
            </button>
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
            <button type="button" class="file-picker" data-action="browse" title="Browse Files">
              <i class="fa-solid fa-file-import"></i>
            </button>
          </div>
        </div>
      </section>
    </div>
    <p class="notes tae-footnote">
      The Actor itself is not renamed, and no statistics, effects, initiative, ownership, vision, or position are changed.
    </p>
  `;

  for (const key of ["a", "b"]) {
    const card = wrapper.querySelector(`[data-identity="${key}"]`);
    const nameInput = card.querySelector('[data-field="name"]');
    const imgInput = card.querySelector('[data-field="img"]');
    const preview = card.querySelector(".tae-preview");

    nameInput.value = values[key].name;
    imgInput.value = values[key].img;
    preview.src = values[key].img || "icons/svg/mystery-man.svg";

    imgInput.addEventListener("change", () => {
      preview.src = imgInput.value || "icons/svg/mystery-man.svg";
    });
  }

  return wrapper;
}

async function browseForImage(input, preview) {
  const FilePickerClass = foundry?.applications?.apps?.FilePicker ?? globalThis.FilePicker;
  if (!FilePickerClass) {
    ui.notifications.error("Token Alter Ego: Foundry's File Picker is unavailable.");
    return;
  }

  const picker = new FilePickerClass({
    type: "image",
    current: input.value,
    callback: (path) => {
      input.value = path;
      preview.src = path || "icons/svg/mystery-man.svg";
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });

  await picker.browse(input.value || "");
}

function readEditorValues(content) {
  const read = (key, field) => content
    .querySelector(`[data-identity="${key}"] [data-field="${field}"]`)
    ?.value
    ?.trim() ?? "";

  return {
    a: { name: read("a", "name"), img: read("a", "img") },
    b: { name: read("b", "name"), img: read("b", "img") }
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

  const content = buildIdentityEditor(actor, tokenDocument);

  content.addEventListener("click", async (event) => {
    const button = event.target.closest('button[data-action="browse"]');
    if (!button) return;
    event.preventDefault();

    const card = button.closest(".tae-identity-card");
    const input = card.querySelector('[data-field="img"]');
    const preview = card.querySelector(".tae-preview");
    await browseForImage(input, preview);
  });

  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2) {
    ui.notifications.error("Token Alter Ego requires Foundry VTT v13 or newer.");
    return;
  }

  const result = await DialogV2.wait({
    window: { title: `Token Alter Ego — ${actor.name}` },
    content,
    modal: true,
    buttons: [
      {
        action: "clear",
        label: "Clear",
        icon: "fa-solid fa-trash",
        callback: () => ({ action: "clear" })
      },
      {
        action: "cancel",
        label: "Cancel",
        icon: "fa-solid fa-xmark",
        callback: () => ({ action: "cancel" })
      },
      {
        action: "save",
        label: "Save Identities",
        icon: "fa-solid fa-floppy-disk",
        default: true,
        callback: () => ({ action: "save", identities: readEditorValues(content) })
      }
    ]
  });

  if (!result || result.action === "cancel") return;

  if (result.action === "clear") {
    await actor.unsetFlag(MODULE_ID, FLAG_IDENTITIES);
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

  await actor.setFlag(MODULE_ID, FLAG_IDENTITIES, result.identities);

  const detected = currentIdentityForToken(tokenDocument, result.identities);
  if (tokenDocument) await tokenDocument.setFlag(MODULE_ID, FLAG_CURRENT, detected);

  ui.notifications.info(`Token Alter Ego: Saved identities for ${actor.name}.`);
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
    onClick(event);
  };

  control.addEventListener("click", activate);
  control.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") activate(event);
  });
  return control;
}

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing Token Alter Ego v1.0.0`);
});

Hooks.on("renderTokenHUD", (hud, html) => {
  const root = getRootElement(html);
  const tokenDocument = getTokenDocument(hud);
  const actor = getActor(hud, tokenDocument);

  if (!root || !tokenDocument || !actor) return;

  root.querySelectorAll(".token-alter-ego-control").forEach((el) => el.remove());

  const identities = getIdentityData(actor);
  const canToggle = game.user.isGM || tokenDocument.isOwner;
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
