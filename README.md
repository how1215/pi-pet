# pi-pet

[![CI](https://github.com/how1215/pi-pet/actions/workflows/ci.yml/badge.svg)](https://github.com/how1215/pi-pet/actions/workflows/ci.yml)
![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)

**A tiny pixel companion for every pi session. No extra tokens. Dedicated pet dialogue.**

A pixel-art extension for the [pi coding agent](https://github.com/earendil-works/pi-mono). Each session gets its own randomly selected companion with dedicated programming-themed dialogue and lightweight animation states.

![Pixel artwork: Cache Cat, Stack Fox, Byte Dragon, Kernel Phoenix](assets/pets.png)

*Pixel-art preview, not a terminal screenshot. Left to right: Cache Cat, Stack Fox, Byte Dragon, and Kernel Phoenix.*

## Features

- **One companion per session:** weighted selection on first load; saved sessions and `/reload` keep the same pet.
- **Non-capturing overlay:** sits in the bottom-right corner without taking keyboard focus or changing your draft.
- **16-by-12 pixel artwork:** rendered in 16-by-6 terminal cells using half-block characters and ANSI 256 colors. No emoji or image protocol required.
- **Dedicated dialogue:** each pet has its own local lines with no consecutive repeats.
- **Visible animation states:** interactions transition through blinking, talking, and idle poses without a continuous idle timer.
- **Status command:** inspect the active companion, rarity, animation, and visibility.
- **No extra model calls:** no registered model tools or pet messages added to the model's context.
- **Layout safeguards:** fixed dimensions, display-width-aware wrapping, and automatic hiding in small terminals.

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
| `/pet status` | Report the pet's name, rarity, animation, and visibility. |
| `Ctrl+\` | Same interaction as `/pet talk`. |

Speech disappears after five seconds. Each interaction transitions through `blinking` (180 ms), `talking`, and `idle`. Repeated interactions select a different line and reset the timers. Talking does not reveal a manually hidden pet. Visibility preferences reset on reload.

`Ctrl+\` maps to the standard `0x1c` control character and works in Terminal.app without a custom key mapping. If another extension uses the same shortcut, pi may report a duplicate binding; disable one binding or use `/pet` only for visibility control.

## Meet the pets

| Rarity | Probability | Companion | Palette |
| --- | ---: | --- | --- |
| N | 60% | Cache Cat | Cream and pink |
| R | 25% | Stack Fox | Orange-red and ivory |
| SR | 12% | Byte Dragon | Ice blue and purple |
| SSR | 3% | Kernel Phoenix | Gold and flame red |

Rarity is cosmetic. There are no rerolls, collection mechanics, payments, or neglect penalties.

Pet IDs remain stable across language updates, so existing saved sessions retain their companions.

## Architecture

```text
session_start
  ├─ restore custom entry, or draw + appendEntry
  └─ zero-height widget owns two non-capturing overlays
       ├─ pet: 22 columns × 7 rows
       └─ speech: 38 columns, at most 6 rows

Ctrl+\ or /pet talk → choose pet line → blinking → talking → idle
/pet                  → toggle visibility and clear speech
/pet status           → report current in-memory status
session_shutdown / widget disposal → remove overlays + clear timers
```

| File | Responsibility |
| --- | --- |
| `index.ts` | Lifecycle events, commands, shortcuts, overlay ownership, and cleanup. |
| `pets.ts` | Pixel artwork, palettes, dedicated dialogue, rarity selection, and state validation. |
| `view.ts` | ANSI half-block rendering, display-width calculations, and speech bubbles. |
| `tests/run.mjs` | Content, rendering, lifecycle, and integration checks using pi's native loader and regular-mode TUI. |

A zero-height widget provides pi's public TUI factory and disposal hook. It owns two non-capturing overlays rather than holding a permanent blocking `custom()` prompt open. The pet does not continuously redraw while idle.

State is stored with `pi.appendEntry("session-pet:v1", ...)` and excluded from the model's context. Restoration reads all session entries so navigating `/tree` within a session does not reroll the companion.

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

Tests cover English content, pet-specific dialogue, all animation states, full pet labels, the absence of panel command hints, pixel dimensions, ANSI display widths from 1 to 120 columns, dialogue wrapping, rarity boundaries, non-repeating lines, state restoration, commands, visibility toggles, timers, cleanup, focus, resizing, and native extension loading.

Try the extension locally without changing pi's installation settings:

```sh
pi -e ./index.ts
```

### Manual verification

1. Type an unsent draft, then press `Ctrl+\`. Confirm that the text and cursor remain unchanged.
2. Trigger several lines with `Ctrl+\` and `/pet talk`. The bubble should close five seconds after the last interaction without moving the pet.
3. Shrink the terminal below 60 columns or 24 rows, then enlarge it. Check for clipped sprites or stale bubbles.
4. Interact during a streaming response and toggle `/pet`. The model should continue uninterrupted.
5. Reload or resume a saved session and confirm that the companion stays the same. A new session gets an independent draw, which may select the same species.

## Credits and license

Created by **how1215** with AI-assisted implementation, pixel-art iteration, and testing. The code uses pi's documented extension APIs and public examples as implementation references.

[MIT License](LICENSE). This is an independent community project, not an official pi component.
