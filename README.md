# pi-pet

[![CI](https://github.com/how1215/pi-pet/actions/workflows/ci.yml/badge.svg)](https://github.com/how1215/pi-pet/actions/workflows/ci.yml)
![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)

**A tiny pixel companion for every pi session. No extra tokens. Dedicated pet dialogue.**

A pixel-art extension for the [pi coding agent](https://github.com/earendil-works/pi-mono). Each session gets its own randomly selected companion with dedicated programming-themed dialogue and lightweight animation states.

![Eight pixel companions with redesigned faces](assets/pets.png)

*Pixel-art preview, not a terminal screenshot. Top row: Cache Cat, Stack Fox, Byte Dragon, Kernel Phoenix. Bottom row: Queue Rabbit, Regex Raccoon, Cloud Otter, Quantum Owl.*

## Features

- **One companion per session:** weighted selection on first load; saved sessions and `/reload` keep the same pet.
- **Non-capturing overlay:** sits in the bottom-right corner without taking keyboard focus or changing your draft.
- **Clearer faces:** eight 16-by-12 sprites with separate high-contrast 2-by-2 eyes and mouths, eye glints, closed eyelids, and readable expressions. Rendered in 16-by-6 terminal cells with ANSI 256 colors.
- **Dedicated dialogue:** each pet has four local lines with no consecutive repeats, for 32 lines in total.
- **Multi-frame pixel animation:** companions breathe, jump, sway, droop, close their eyes, move their mouths, and emit small pixel effects instead of only changing colours.
- **Live state label:** the active animation appears to the right of the companion name.
- **Progression:** feeding and playing award XP and affinity; every 100 XP raises the pet level.
- **Collection:** level milestones unlock companions that can be viewed and selected by ID.
- **More reactions:** sleeping, celebrating, sad, eating, and playing poses join the existing idle, blinking, and talking states.
- **Tool feedback:** successful and failed tool executions trigger local visual reactions without changing progression.
- **No extra model calls:** no registered model tools or pet messages added to the model's context.
- **Layout safeguards:** fixed dimensions, display-width-aware wrapping, and automatic hiding in small terminals.

See [CHANGELOG.md](CHANGELOG.md) for release details.

## Installation

Requires pi. Development and automated tests target **pi 0.85.1 and Node.js 22.19.0 or later**.

```sh
pi install https://github.com/how1215/pi-pet
```

The default installation is global and is auto-discovered from pi's user package storage in every project. A manual source installation can instead place this repository at `~/.pi/agent/extensions/session-pet/`. Run `/reload` in pi to activate it.

To install it for one project only:

```sh
pi install -l https://github.com/how1215/pi-pet
```

If you already have a manually installed `session-pet` extension, remove or disable that copy first to avoid duplicate commands and shortcuts.

The extension runs only in interactive TUI mode. Print, JSON, and RPC modes do not create a pet or start timers.

### Updating

For an unpinned Git installation:

```sh
pi update https://github.com/how1215/pi-pet
```

Then run `/reload`. Installations pinned to a release tag retain that release's behavior and language until explicitly updated; old tags are not rewritten.

### Uninstalling

```sh
pi remove https://github.com/how1215/pi-pet
```

Use `pi remove -l` for a project-local installation, then run `/reload`.

## Controls

| Input | Action |
| --- | --- |
| `/pet` | Toggle visibility without changing the pet or triggering speech. |
| `/pet talk` | Show a non-repeating line from the active pet's dedicated dialogue. |
| `/pet status` | Report the pet's level, XP, affinity, animation, and visibility. |
| `/pet feed` | Gain 15 XP and 10 affinity; trigger the eating pose. |
| `/pet play` | Gain 25 XP and 15 affinity; trigger the playing pose. |
| `/pet list` | Show every companion and its active, unlocked, or locked state. |
| `/pet select <pet-id>` | Select an unlocked companion. |
| `Ctrl+\` | Same interaction as `/pet talk`. |

Speech disappears after five seconds. Talking transitions through `blinking` (180 ms), `talking`, and `idle`. The pet sleeps after 60 seconds without activity. Successful tools trigger `celebrating`; failed tools trigger `sad`. Repeated talk interactions select a different line and reset the timers. Interactions do not reveal a manually hidden pet. Visibility preferences reset on reload.

`Ctrl+\` maps to the standard `0x1c` control character and works in Terminal.app without a custom key mapping. If another extension uses the same shortcut, pi may report a duplicate binding; disable one binding or use `/pet` only for visibility control.

## Meet the pets

| Rarity | Individual probability | Companion | ID | Unlock level |
| --- | ---: | --- | --- | ---: |
| N | 30% | Cache Cat | `cache-cat` | 1 |
| N | 30% | Queue Rabbit | `queue-rabbit` | 1 |
| R | 12.5% | Stack Fox | `stack-fox` | 2 |
| R | 12.5% | Regex Raccoon | `regex-raccoon` | 2 |
| SR | 6% | Byte Dragon | `byte-dragon` | 3 |
| SR | 6% | Cloud Otter | `cloud-otter` | 3 |
| SSR | 1.5% | Kernel Phoenix | `kernel-phoenix` | 5 |
| SSR | 1.5% | Quantum Owl | `quantum-owl` | 5 |

The draw first selects rarity at 60% / 25% / 12% / 3%, then uniformly selects a species within that rarity. The initial draw is always unlocked, even above the current level. Both N companions are available immediately. Affinity is capped at 100. There are no payments or neglect penalties.

Existing pet IDs remain stable. Old v2 saves automatically gain newly eligible unlocks without losing their selected pet, XP, affinity, or previously unlocked rare pets. Progression and collection are per session, not shared across projects.

### Expressions and motion

Each species defines its own eye and mouth coordinates and ear, tail, wing, or paw patches. Facial features move with the padded body instead of being stamped at fixed screen coordinates.

| State | Expression and motion | Frame interval |
| --- | --- | ---: |
| idle | Open eyes with glints, breathing and species-specific movement | 900 ms |
| blinking | Horizontal closed eyelids; returns to talking after 180 ms | Single pose |
| talking | Mouth opens and closes; tongue visible in the open frame | 260 ms |
| eating | Chewing mouth and crumbs near that pet's mouth | 260 ms |
| playing | Happy eyes, smiling mouth, sideways jumps | 260 ms |
| celebrating | Happy face, jumping, edge sparkles | 260 ms |
| sad | Downturned eyes and mouth, drooping body | 260 ms |
| sleeping | Closed eyes, gentle body movement, sleep particle | 1200 ms |

[Full animation contact sheet](assets/animations.png): columns follow the preview's top row then bottom row; pairs of rows show frames 0 and 1 of idle, blinking, talking, sleeping, celebrating, sad, eating, and playing.

## Architecture

```text
session_start
  ├─ restore custom entry, or draw + appendEntry
  └─ zero-height widget owns two non-capturing overlays
       ├─ pet: 34 columns × 7 rows
       └─ speech: 38 columns, at most 6 rows

Ctrl+\ or /pet talk → choose pet line → blinking → talking → idle
/pet feed or play     → persist progression → eating or playing
/pet list/select      → inspect or change unlocked companion
successful/failed tool → celebrating/sad → idle → sleeping
/pet                  → toggle visibility and clear speech
session_shutdown / widget disposal → remove overlays + clear timers
```

| File | Responsibility |
| --- | --- |
| `index.ts` | Lifecycle events, commands, shortcuts, overlay ownership, and cleanup. |
| `pets.ts` | Palettes, dedicated dialogue, rarity buckets, progression, and state validation. |
| `artwork.ts` | Padded silhouettes, species-specific facial coordinates, and movement patches. |
| `view.ts` | Facial expressions, frame composition, immutable ANSI sprite cache, and layout. |
| `tests/run.mjs` | Content, rendering, lifecycle, and integration checks using pi's native loader and regular-mode TUI. |

A zero-height widget provides pi's public TUI factory and disposal hook. It owns two non-capturing overlays rather than holding a permanent blocking `custom()` prompt open.

Animation uses one state-dependent frame timeout, not a fixed interval. Hidden pets, blocking extension prompts, and small terminals stop frame scheduling and animation redraws. Normal host redraws (including resize) resume a paused loop without resize polling. Speech expiry and sleep timers may still update internal state while hidden; all timers are cleared on disposal.

Each pet caches at most 16 immutable ANSI sprites (8 states x 2 frames). Sprite geometry and colours are theme-independent; the name/state label uses the current theme. Bubble wrapping is cached until text, width, or theme invalidation changes. Compared with the former 450 ms loop, scheduled idle and sleeping redraw rates are reduced by 50% and 62.5%, respectively; these are scheduling rates, not measured CPU savings.

Progression snapshots are stored with `pi.appendEntry("session-pet:v2", ...)` and excluded from the model's context. The latest valid snapshot restores the selected pet, XP, level, affinity, and unlocks. Existing `session-pet:v1` entries are migrated automatically and retain their selected companion.

Forks and clones inherit the pet when they retain its custom entry. Branching from before the extension was first enabled creates a new pet. Sessions started with `--no-session` do not persist across processes.

## Limitations

- Pi's overlay API is experimental. Not every pi version or terminal has been verified.
- The minimum visible terminal size is **60 columns by 24 rows**. The pet hides below this threshold and returns when space is available.
- Overlays reserve two columns on the right and four rows at the bottom. They are rectangular, not pixel-transparent, and may cover transcript content or a tall input editor. Use `/pet` to hide them.
- Blocking extension UI temporarily hides the pet. Continuous visibility is not guaranteed in built-in menus or native terminal scrollback.
- Use a monospaced font and standard Unicode character widths. Automated layout tests do not replace visual checks in your terminal.

## Development

```sh
git clone https://github.com/how1215/pi-pet.git
cd pi-pet
npm ci
npm run check
```

`check` runs TypeScript type checking and the automated test suite. GitHub Actions runs the checks on Node.js 22 and 24.

Tests cover all eight pets and animation states, exact eye/mouth patterns, unclipped faces, palette validation, cache reuse and invalidation, species probabilities, new unlock repair, v1/v2 saves, dialogue, full name/state labels, paused redraws, resizing, timer disposal, focus, and native extension loading.

Regenerate the preview images from the actual renderer with `npm run preview` (no graphics dependencies). For a manually installed global copy, tests can be run from any directory:

```sh
node ~/.pi/agent/extensions/session-pet/tests/run.mjs \
  /opt/homebrew/Cellar/pi-coding-agent/0.85.1/libexec/lib/node_modules/@earendil-works/pi-coding-agent
```

Adjust the pi package path if your installation differs.

Try the extension locally without changing pi's installation settings:

```sh
pi -e ./index.ts
```

### Manual verification

1. Type an unsent draft, then press `Ctrl+\`. Confirm that the text and cursor remain unchanged.
2. Trigger several lines with `Ctrl+\` and `/pet talk`. The bubble should close five seconds after the last interaction without moving the panel. Inspect mouth opening/closing and the adjacent animation label for each pet.
3. Use `/pet feed`, `/pet play`, `/pet list`, and `/pet select`; reload and confirm progression remains intact.
4. Run successful and failing tools, then wait for the sleeping pose. Confirm each reaction renders and expires.
5. Shrink the terminal below 60 columns or 24 rows, then enlarge it. Check for clipped sprites or stale bubbles.
6. Interact during a streaming response and toggle `/pet`. The model should continue uninterrupted.
7. Reload or resume a saved session and confirm that the companion stays the same. A new session gets an independent draw, which may select the same species.

## Credits and license

Created by **how1215** with AI-assisted implementation, pixel-art iteration, and testing. The code uses pi's documented extension APIs and public examples as implementation references.

[MIT License](LICENSE). This is an independent community project, not an official pi component.
