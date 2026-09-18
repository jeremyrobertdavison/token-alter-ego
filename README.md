# Token Alter Ego

**Token Alter Ego** is a lightweight, system-agnostic Foundry VTT module for characters who use two visual identities, such as a civilian identity and a heroic identity.

The module changes only the placed token's **displayed name**, **token artwork**, **width**, and **height**. It does not swap Actors or change statistics, hit points, effects, initiative, ownership, vision, position, or other character data.

## Features

- Configure two identities on an Actor.
- Give each identity its own displayed token name and token artwork.
- Give each identity its own token width and height in grid spaces.
- Toggle between identities from the Token HUD.
- Current identity is tracked independently for each placed token.
- Configuration controls are GM-only.
- Players who own a token may use its identity toggle after the GM configures it.
- Existing v1.0.x identity configurations default to 1 x 1 until another size is saved.
- System agnostic.
- Designed for Foundry VTT v13.

## Example

Identity A:
- Name: Bruce Banner
- Artwork: `bruce-banner.webp`
- Width: `1`
- Height: `1`

Identity B:
- Name: Hulk
- Artwork: `hulk.webp`
- Width: `2`
- Height: `2`

A single Token HUD button then switches the placed token between Bruce Banner at 1 x 1 and Hulk at 2 x 2 without replacing the Actor or token.

Token size changes preserve the token's existing top-left position on the grid. A token growing from 1 x 1 to 2 x 2 therefore expands to the right and downward from that square.

## Installation

Use the manifest URL:

`https://github.com/jeremyrobertdavison/token-alter-ego/releases/latest/download/module.json`

## License

MIT
