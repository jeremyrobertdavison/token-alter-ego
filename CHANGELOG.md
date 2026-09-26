# Changelog

## 1.2.0
- Added optional per-identity Actor avatar image fields.
- Swapping identities can now change the Actor avatar/portrait image in addition to token name, token artwork, and token size.
- Added separate token and avatar previews in the configuration dialog.
- Players with ownership can still toggle identities; the active GM applies token and avatar changes.

## 1.1.1
- Fixed identity persistence across reloads by storing configuration on the base Actor.
- Added per-token configuration fallback caching.
- Players with Owner permission can change identities while configuration remains GM-only.
