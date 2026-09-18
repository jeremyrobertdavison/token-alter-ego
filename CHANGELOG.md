# Changelog

## 1.1.0
- Added configurable token width and height for each identity.
- Identity swaps now update displayed name, artwork, width, and height together.
- Existing v1.0.x configurations safely default missing dimensions to 1 x 1.
- Supports fractional positive grid sizes through the configuration fields.
- Token position is preserved when size changes; resizing expands or shrinks from the current top-left position.

## 1.0.2
- Fixed the Foundry V13 DialogV2 `config.content element must have no attributes` error.
- Configuration content is now supplied to DialogV2 as an HTML string, matching the documented v13 usage.
- Preserved identity names and image paths safely when serializing the configuration form.

## 1.0.1
- Fixed the Configure Alter Ego HUD action so the Foundry V13 DialogV2 configuration window opens reliably.
- Moved dialog event wiring to DialogV2's render callback, matching Foundry V13 behavior.
- Improved FilePicker handling.
- Added visible error notifications and console diagnostics instead of silent failures.

## 1.0.0
- Initial release.
- Two identities per Actor.
- Each identity stores a token display name and token image.
- One-click identity switching from the Token HUD.
- GM-only identity configuration.
- Player toggle support for owned tokens.
- Per-token current identity state.
