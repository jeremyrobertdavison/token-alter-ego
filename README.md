# Token Alter Ego

**Token Alter Ego** is a lightweight, system-agnostic Foundry VTT module that gives an Actor two token identities and lets an authorized user switch between them from the Token HUD.

The module changes only the **placed token's displayed name and token artwork**. It does not swap Actors or alter statistics, HP, resources, effects, initiative, ownership, vision, disposition, position, elevation, or character-sheet data.

## Example

Configure an Actor with:

- **Identity A:** Peter Parker + `peter-parker.webp`
- **Identity B:** Spider-Man + `spider-man.webp`

Select the token and use the Token HUD's **Change Identity** button to switch instantly between the two.

## Features

- Two identities per Actor
- Each identity stores a displayed token name and token artwork
- One-click toggle directly on the Token HUD
- Current identity is stored per placed token
- Identity definitions are stored on the Actor
- Players who own a token may toggle it
- Identity configuration is GM-only
- System-agnostic: no game-system-specific data is touched
- No dependencies

## Foundry Compatibility

- Minimum: Foundry VTT v13
- Verified target: Foundry VTT v13

## Installation

### Manifest URL

After publishing a GitHub release containing both `module.json` and `token-alter-ego.zip`, install the module from Foundry using:

```text
https://github.com/jeremyrobertdavison/token-alter-ego/releases/latest/download/module.json
```

### Manual Installation

Extract the `token-alter-ego` folder into:

```text
FoundryVTT/Data/modules/
```

Then restart Foundry and enable **Token Alter Ego** in your world.

## Usage

1. Enable **Token Alter Ego** in the world.
2. Place an Actor's token on a Scene.
3. As GM, open that token's Token HUD.
4. Click the **Configure Token Alter Ego** button (person-with-pencil icon).
5. Set the name and token artwork for Identity A and Identity B.
6. Save.
7. Open the Token HUD again and click the **Change Identity** button (repeat-arrows icon).
8. The placed token changes its displayed name and artwork instantly.

The underlying Actor remains the same.

## Permissions

- GMs can configure identities and toggle tokens.
- Players can toggle tokens they own after the GM has configured the Actor's identities.
- Players cannot edit the identity definitions.

## Data Storage

Identity definitions are stored as Actor flags under:

```text
flags.token-alter-ego.identities
```

The currently selected identity for each placed token is stored under:

```text
flags.token-alter-ego.currentIdentity
```

## Release Packaging

For a GitHub release, attach these two assets:

- `module.json`
- `token-alter-ego.zip`

The release ZIP should contain `module.json`, `scripts/`, `styles/`, and the other module files directly at the ZIP root. Do not wrap those files in an extra `token-alter-ego` folder inside the release ZIP.

## License

MIT License. See `LICENSE`.
