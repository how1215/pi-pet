# Changelog

All notable changes to pi-pet are documented here.

## 2.0.0

### Breaking changes

- Remove XP, levels, unlocks, permanent collection state, duplicate inventory, and `/pet select`.
- Ignore all earlier session-pet state formats. The first v2.0 load in an existing session creates a fresh N starter and writes `session-pet:v4` state.
- Feeding now grants 10 affinity and playing grants 15 affinity. Drawing a replacement resets affinity to zero.

### Added

- `/pet draw`: play a one-second drawing animation, then immediately replace the current companion using explicit weighted odds.
- `Ctrl+\\` now triggers the same quick draw as `/pet draw`; talking remains available through `/pet talk`.
- Hidden SSR Bug, with a 0.3% draw chance, glitch artwork, all nine animation states, and four dedicated lines.
- `drawing` animation with a 140 ms frame delay, body glitches, and moving edge pixels.
- Encyclopedia probabilities in `/pet list`. Inactive Bug appears only as `??? | Hidden | SSR | 0.3%`; its details are visible while active.
- Guards against overlapping draws and cleanup for pending draw timers.

### Changed

- New sessions start evenly between Cache Cat and Queue Rabbit instead of drawing from all rarities.
- The lottery has exact species odds: N 30% each, R 12.5% each, SR 6% each, Kernel Phoenix and Quantum Owl 1.35% each, and Bug 0.3%.
- Drawing the same species is valid and saves a fresh current-pet snapshot; no pet is permanently owned or discovered.
- State is reduced to `{ version: 4, petId, affinity }` and remains local to the current session.
- Preview assets now contain nine pets and nine animation states. The automated suite contains 41 checks.

## 1.4.0

### Added

- Queue Rabbit (N), Regex Raccoon (R), Cloud Otter (SR), and Quantum Owl (SSR), each with four dedicated lines and all eight animation states.
- Species-specific eye/mouth coordinates and ear, tail, wing, or paw movement patches.
- Separate high-contrast 2x2 eyes and mouths, glints, closed eyelids, happy/sad faces, chewing, and open-mouth talking.
- Regenerated eight-pet preview and full animation contact sheet; `npm run preview` reproduces both without graphics dependencies.
- Tests for exact face patches, unclipped geometry, independent species draws, old-save unlock repair, cache reuse, and paused/resumed animation scheduling.

### Changed

- Redrawn all four original silhouettes with safety margins so animated movement does not crop facial features.
- Draw rarity first (60% / 25% / 12% / 3%), then uniformly select a species in that rarity. Individual chances are 30%, 12.5%, 6%, or 1.5%.
- Both pets in a rarity unlock at levels 1 / 2 / 3 / 5. Older v2 snapshots gain eligible species once while preserving progression, selected companion, and rare unlocks. State remains `session-pet:v2`; v1 migration is still supported.
- Replace the 450 ms interval with a single frame timeout: active states 260 ms, idle 900 ms, sleeping 1200 ms. Pause animation redraws while hidden, prompting, or below the terminal size cutoff; resume on host rendering without polling.
- Cache up to 16 immutable ANSI frames per pet and reuse bubble layout until text, width, or theme changes. Name/state labels continue to follow the current theme.
- TypeScript checking and 42 automated checks cover the new artwork, progression compatibility, and animation lifecycle.

## 1.3.0

### Added

- Two-frame geometric animation for idle and long-lived companion activities at a lightweight 450 ms interval.
- Idle breathing, talking mouth movement, sleeping body movement and pixel effects, celebration jumps and sparkles, sad drooping, eating crumbs, and playful side-to-side jumps.
- The current animation state is displayed directly to the right of the companion name.
- Rendering tests that verify animation frames change pixel geometry rather than only ANSI colours.

### Changed

- The pet panel is 34 columns wide so every companion name and animation state remains visible, including `Kernel Phoenix · celebrating`.
- Animation timers are owned by the session widget and cleaned up during reload, session replacement, and shutdown.
- The automated suite now contains 30 checks.

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
