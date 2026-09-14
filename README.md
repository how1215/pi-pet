# pi-pet

[![CI](https://github.com/how1215/pi-pet/actions/workflows/ci.yml/badge.svg)](https://github.com/how1215/pi-pet/actions/workflows/ci.yml)
![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)

**Draw a pixel companion for each pi session. No extra tokens. No permanent collection.**

A pixel-art extension for the [pi coding agent](https://github.com/earendil-works/pi-mono). Every new session starts with an N companion; `/pet draw` immediately replaces it with a weighted random pet that stays until the next draw.

![Nine pixel companions, including the hidden Bug](assets/pets.png)

*Pixel-art preview, not a terminal screenshot. Cache Cat, Stack Fox, Byte Dragon, Kernel Phoenix, Queue Rabbit, Regex Raccoon, Cloud Otter, hidden SSR Bug, and Quantum Owl.*

## Features

- **One companion at a time:** each session starts with a random N pet; draws replace it, while saved sessions and `/reload` retain the latest result.
- **Non-capturing overlay:** sits in the bottom-right corner without taking keyboard focus or changing your draft.
- **Clearer faces:** nine 16-by-12 sprites with separate high-contrast 2-by-2 eyes and mouths, eye glints, closed eyelids, and readable expressions. Rendered in 16-by-6 terminal cells with ANSI 256 colors.
- **Dedicated dialogue:** each pet has four local lines with no consecutive repeats, for 36 lines in total.
- **Multi-frame pixel animation:** companions breathe, jump, sway, droop, close their eyes, move their mouths, and emit small pixel effects instead of only changing colours.
- **Live state label:** the active animation appears to the right of the companion name.
- **Instant lottery:** `/pet draw` uses explicit per-species odds and immediately switches the active companion after a one-second reveal.
- **Session-bound ownership:** only the current pet is stored; there is no collection, duplicate inventory, level gate, or manual selection.
- **Hidden SSR:** Bug has a 0.3% chance and stays concealed in the encyclopedia unless currently active.
- **Affinity:** feeding and playing bond with the current pet; a new draw resets affinity to zero.
- **More reactions:** sleeping, celebrating, sad, eating, and playing poses join the existing idle, blinking, and talking states.
- **Tool feedback:** successful and failed tool executions trigger local visual reactions without changing affinity.
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
| `/pet draw` | Draw a random pet and immediately make it the active companion. |
| `/pet status` | Report the current pet's rarity, affinity, animation, and visibility. |
| `/pet feed` | Gain 10 affinity with the current pet; trigger the eating pose. |
| `/pet play` | Gain 15 affinity with the current pet; trigger the playing pose. |
| `/pet list` | Show the species encyclopedia, rarity, probability, and active pet. |
| `Ctrl+\` | Same interaction as `/pet draw` for a quick draw. |

A draw shows the fast `drawing` animation for one second; overlapping draws are rejected. The result enters `celebrating`, even when the same species stays. Speech disappears after five seconds. Talking transitions through `blinking` (180 ms), `talking`, and `idle`. The pet sleeps after 60 seconds without activity. Successful tools trigger `celebrating`; failed tools trigger `sad`. Interactions do not reveal a manually hidden pet. Visibility preferences reset on reload.

`Ctrl+\` maps to the standard `0x1c` control character and works in Terminal.app without a custom key mapping. If another extension uses the same shortcut, pi may report a duplicate binding; disable one binding or use `/pet draw` directly.

## Meet the pets

| Rarity | Probability | Companion | ID |
| --- | ---: | --- | --- |
| N | 30% | Cache Cat | `cache-cat` |
| N | 30% | Queue Rabbit | `queue-rabbit` |
| R | 12.5% | Stack Fox | `stack-fox` |
| R | 12.5% | Regex Raccoon | `regex-raccoon` |
| SR | 6% | Byte Dragon | `byte-dragon` |
| SR | 6% | Cloud Otter | `cloud-otter` |
| SSR | 1.35% | Kernel Phoenix | `kernel-phoenix` |
| SSR | 1.35% | Quantum Owl | `quantum-owl` |
| Hidden SSR | 0.3% | Bug | `bug` |

Probabilities total 100%. New sessions start evenly between the two N pets; the table applies to `/pet draw`. Drawing the same species is a valid result. No pet is permanently owned: a result remains active only in that session and only until the next draw. Affinity is capped at 100 and resets on replacement.

`/pet list` shows Bug as `??? | Hidden | SSR | 0.3%` unless Bug is currently active. Once another pet replaces it, Bug becomes hidden again because discovery is not retained.

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
| drawing | Fast body glitch, moving pixels, and rarity-like flashes | 140 ms |

[Full animation contact sheet](assets/animations.png): columns are Cache Cat, Stack Fox, Byte Dragon, Kernel Phoenix, Queue Rabbit, Regex Raccoon, Cloud Otter, Bug, and Quantum Owl; pairs of rows show frames 0 and 1 of idle, blinking, talking, sleeping, celebrating, sad, eating, playing, and drawing.

## Architecture

```text
session_start
  ├─ restore custom entry, or draw + appendEntry
  └─ zero-height widget owns two non-capturing overlays
       ├─ pet: 34 columns × 7 rows
       └─ speech: 38 columns, at most 6 rows

new session            → random N starter
/pet draw or Ctrl+\   → drawing → replace current pet → celebrating
/pet talk              → choose pet line → blinking → talking → idle
/pet feed or play      → persist current affinity → eating or playing
/pet list              → show encyclopedia probabilities and current pet
successful/failed tool → celebrating/sad → idle → sleeping
/pet                  → toggle visibility and clear speech
session_shutdown / widget disposal → remove overlays + clear timers
```

| File | Responsibility |
| --- | --- |
| `index.ts` | Lifecycle events, commands, shortcuts, overlay ownership, and cleanup. |
| `pets.ts` | Palettes, dialogue, starter selection, lottery boundaries, affinity, and v4 validation. |
| `artwork.ts` | Padded silhouettes, species-specific facial coordinates, and movement patches. |
| `view.ts` | Facial expressions, frame composition, immutable ANSI sprite cache, and layout. |
| `tests/run.mjs` | Content, rendering, lifecycle, and integration checks using pi's native loader and regular-mode TUI. |

A zero-height widget provides pi's public TUI factory and disposal hook. It owns two non-capturing overlays rather than holding a permanent blocking `custom()` prompt open.

Animation uses one state-dependent frame timeout, not a fixed interval. Hidden pets, blocking extension prompts, and small terminals stop frame scheduling and animation redraws. Normal host redraws (including resize) resume a paused loop without resize polling. Speech expiry and sleep timers may still update internal state while hidden; all timers are cleared on disposal.

Each pet caches at most 18 immutable ANSI sprites (9 states x 2 frames). Sprite geometry and colours are theme-independent; the name/state label uses the current theme. Bubble wrapping is cached until text, width, or theme invalidation changes. Compared with the former 450 ms loop, scheduled idle and sleeping redraw rates are reduced by 50% and 62.5%, respectively; these are scheduling rates, not measured CPU savings.

Current-pet snapshots use `pi.appendEntry("session-pet:v4", { version: 4, petId, affinity })` and stay outside model context. Reloading or resuming restores the latest current pet in that session. Older state formats are intentionally ignored; the first v2.0 load creates a fresh N starter.

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

Tests cover all nine pets and animation states, exact eye/mouth patterns, unclipped faces, palette validation, cache reuse, starter selection, exact lottery boundaries, hidden Bug behavior, immediate replacement, same-species draws, affinity reset, ignored old state, paused redraws, draw cancellation, focus, and native extension loading.

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
2. Trigger several lines with `/pet talk`. The bubble should close five seconds after the last interaction without moving the panel. Inspect mouth opening/closing and the adjacent animation label for each pet.
3. Use `/pet feed`, `/pet play`, and `/pet draw`; confirm the result immediately replaces the pet and resets affinity. Reload and confirm the current result remains.
4. Run successful and failing tools, then wait for the sleeping pose. Confirm each reaction renders and expires.
5. Shrink the terminal below 60 columns or 24 rows, then enlarge it. Check for clipped sprites or stale bubbles.
6. Interact during a streaming response and toggle `/pet`. The model should continue uninterrupted.
7. Reload or resume a saved session and confirm that the companion stays the same. A new session gets an independent N starter, which may select the same species.

## Credits and license

Created by **how1215** with AI-assisted implementation, pixel-art iteration, and testing. The code uses pi's documented extension APIs and public examples as implementation references.

[MIT License](LICENSE). This is an independent community project, not an official pi component.
