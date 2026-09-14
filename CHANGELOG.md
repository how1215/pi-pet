# Changelog

All notable changes to pi-pet are documented here.

## 1.2.0

### Added

- Persistent session progression with XP, levels, and affinity capped at 100.
- `/pet feed` for 15 XP and 10 affinity.
- `/pet play` for 25 XP and 15 affinity.
- `/pet list` collection view with active, unlocked, and locked companions.
- `/pet select <pet-id>` for switching to an unlocked companion.
- Level-based unlock milestones: Cache Cat at level 1, Stack Fox at level 2, Byte Dragon at level 3, and Kernel Phoenix at level 5.
- Sleeping, celebrating, sad, eating, and playing animation states.
- Celebrating and sad reactions for successful and failed tool executions.
- Automatic sleeping state after 60 seconds without pet activity.
- Argument completion for all new `/pet` subcommands and pet IDs.

### Changed

- Session state now uses `session-pet:v2` snapshots containing the selected pet, XP, level, affinity, and unlocked pet IDs.
- Existing `session-pet:v1` entries migrate automatically while retaining the selected companion.
- The automated suite now contains 29 checks covering progression, collection behavior, migration, reactions, and all animation states.

## 1.1.0

### Added

- Four dedicated programming-themed dialogue lines for each companion.
- `/pet talk` for triggering the active companion's dialogue.
- `/pet status` for reporting identity, rarity, animation, and visibility.
- Idle, blinking, and talking animation states.
- Argument completion for the `talk` and `status` subcommands.

### Changed

- `Ctrl+\\` now triggers the same interaction as `/pet talk`.
- Documentation now describes global installation and auto-discovery from `~/.pi/agent/extensions/session-pet/`.
- Dialogue and animations remain entirely local and do not add model calls or model context.
