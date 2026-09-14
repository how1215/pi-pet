import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { OverlayHandle, TUI } from "@earendil-works/pi-tui";
import { drawPet, gainProgress, nextJoke, PETS, restorePet, STATE_TYPE, XP_PER_LEVEL } from "./pets.ts";
import type { AnimationState, Pet, PetState } from "./pets.ts";
import { BOTTOM_MARGIN, BUBBLE_WIDTH, canShow, PET_HEIGHT, PET_WIDTH, renderBubble, renderPet } from "./view.ts";

const WIDGET = "session-pet:overlay-owner";
const SLEEP_DELAY = 60_000;

export default function sessionPet(pi: ExtensionAPI) {
	let tui: TUI | undefined;
	let petHandle: OverlayHandle | undefined;
	let bubbleHandle: OverlayHandle | undefined;
	let bubbleTimer: ReturnType<typeof setTimeout> | undefined;
	let animationTimer: ReturnType<typeof setTimeout> | undefined;
	let sleepTimer: ReturnType<typeof setTimeout> | undefined;
	let hidden = false;
	let prompting = false;
	let animation: AnimationState = "idle";
	let speech = "";
	let previousLine = -1;
	let activePet: Pet | undefined;
	let state: PetState | undefined;

	function updateVisibility() {
		petHandle?.setHidden(hidden || prompting);
		bubbleHandle?.setHidden(hidden || prompting || !speech);
		tui?.requestRender();
	}

	function clearActivityTimers() {
		clearTimeout(bubbleTimer);
		clearTimeout(animationTimer);
		clearTimeout(sleepTimer);
		bubbleTimer = animationTimer = sleepTimer = undefined;
	}

	function scheduleSleep() {
		clearTimeout(sleepTimer);
		if (!tui || !activePet) return;
		sleepTimer = setTimeout(() => {
			if (!speech) {
				animation = "sleeping";
				updateVisibility();
			}
		}, SLEEP_DELAY);
	}

	function persistState() {
		if (!state) return;
		pi.appendEntry(STATE_TYPE, { ...state, unlockedPetIds: [...state.unlockedPetIds] });
	}

	function react(text: string, nextAnimation: AnimationState, duration = 3000) {
		if (!tui || !activePet) return;
		clearActivityTimers();
		speech = text;
		animation = nextAnimation;
		bubbleTimer = setTimeout(() => {
			speech = "";
			animation = "idle";
			updateVisibility();
			scheduleSleep();
		}, duration);
		updateVisibility();
	}

	function cleanup() {
		clearActivityTimers();
		petHandle?.hide();
		bubbleHandle?.hide();
		petHandle = bubbleHandle = undefined;
		tui = undefined;
		activePet = undefined;
		state = undefined;
	}

	pi.on("session_start", (_event, ctx) => {
		cleanup();
		if (ctx.mode !== "tui") return;
		hidden = prompting = false;
		animation = "idle";
		speech = "";
		previousLine = -1;
		const restored = restorePet(ctx.sessionManager.getEntries());
		state = restored?.state ?? drawPet();
		if (!restored || restored.migrated) persistState();
		activePet = PETS.find((candidate) => candidate.id === state!.petId)!;

		// A zero-height widget provides the supported TUI factory + disposal hook.
		// Raw non-capturing overlays avoid a permanent custom() prompt/wait state.
		ctx.ui.setWidget(WIDGET, (renderer, theme) => {
			tui = renderer;
			petHandle = renderer.showOverlay({
				render: (width) => renderPet(activePet!, width, theme, animation),
				invalidate() {},
			}, {
				nonCapturing: true,
				anchor: "bottom-right",
				width: PET_WIDTH,
				margin: { right: 2, bottom: BOTTOM_MARGIN },
				visible: canShow,
			});
			bubbleHandle = renderer.showOverlay({
				render: (width) => renderBubble(speech, width, theme),
				invalidate() {},
			}, {
				nonCapturing: true,
				anchor: "bottom-right",
				width: BUBBLE_WIDTH,
				margin: { right: 2, bottom: BOTTOM_MARGIN + PET_HEIGHT },
				visible: canShow,
			});
			updateVisibility();
			scheduleSleep();
			return { render: () => [], invalidate() {}, dispose: cleanup };
		});
	});

	function talk(ctx: ExtensionContext) {
		if (ctx.mode !== "tui" || !tui || !activePet || hidden || prompting) return;
		if (!canShow(tui.terminal.columns, tui.terminal.rows)) {
			ctx.ui.notify("Your pet needs at least 60 columns by 24 rows. Resize the terminal to bring it back.", "info");
			return;
		}
		clearActivityTimers();
		previousLine = nextJoke(previousLine, Math.random, activePet.lines);
		speech = activePet.lines[previousLine];
		animation = "blinking";
		animationTimer = setTimeout(() => {
			animation = "talking";
			tui?.requestRender();
		}, 180);
		bubbleTimer = setTimeout(() => {
			speech = "";
			animation = "idle";
			updateVisibility();
			scheduleSleep();
		}, 5000);
		updateVisibility();
	}

	function train(ctx: ExtensionContext, kind: "feed" | "play") {
		if (ctx.mode !== "tui" || !state || !activePet) return;
		const gains = kind === "feed" ? { xp: 15, affinity: 10 } : { xp: 25, affinity: 15 };
		const result = gainProgress(state, gains.xp, gains.affinity);
		state = result.state;
		persistState();
		const unlocked = result.unlocked.map((id) => PETS.find((pet) => pet.id === id)!.name);
		const suffix = unlocked.length ? ` Unlocked: ${unlocked.join(", ")}!` : "";
		react(
			kind === "feed" ? `Crunch! +${gains.xp} XP, +${gains.affinity} affinity.${suffix}` : `That was fun! +${gains.xp} XP, +${gains.affinity} affinity.${suffix}`,
			kind === "feed" ? "eating" : "playing",
		);
	}

	pi.registerCommand("pet", {
		description: "Manage, train, or inspect your pixel pet",
		getArgumentCompletions: (prefix) => {
			const values = prefix.startsWith("select ")
				? PETS.map((pet) => `select ${pet.id}`)
				: ["talk", "status", "feed", "play", "list", "select"];
			const items = values.filter((value) => value.startsWith(prefix));
			return items.length ? items.map((value) => ({ value, label: value })) : null;
		},
		handler: async (args, ctx) => {
			const [action = "", value, ...extra] = args.trim().toLowerCase().split(/\s+/);
			if (action === "talk" && !value) return talk(ctx);
			if (action === "feed" && !value) return train(ctx, "feed");
			if (action === "play" && !value) return train(ctx, "play");
			if (action === "status" && !value) {
				if (ctx.mode !== "tui" || !state || !activePet) return;
				ctx.ui.notify(`${activePet.name} | Rarity: ${activePet.rarity} | Level: ${state.level} | XP: ${state.xp} (${state.xp % XP_PER_LEVEL}/${XP_PER_LEVEL}) | Affinity: ${state.affinity}/100 | Animation: ${animation} | Visibility: ${hidden ? "hidden" : "visible"}`, "info");
				return;
			}
			if (action === "list" && !value) {
				if (ctx.mode !== "tui" || !state) return;
				const lines = PETS.map((pet) => {
					const marker = pet.id === state!.petId ? "active" : state!.unlockedPetIds.includes(pet.id) ? "unlocked" : `locked: level ${pet.unlockLevel}`;
					return `${pet.id} | ${pet.name} | ${pet.rarity} | ${marker}`;
				});
				ctx.ui.notify(lines.join("\n"), "info");
				return;
			}
			if (action === "select" && value && extra.length === 0) {
				if (ctx.mode !== "tui" || !state) return;
				const selected = PETS.find((pet) => pet.id === value);
				if (!selected) {
					ctx.ui.notify(`Unknown pet: ${value}. Use /pet list.`, "warning");
					return;
				}
				if (!state.unlockedPetIds.includes(selected.id)) {
					ctx.ui.notify(`${selected.name} unlocks at level ${selected.unlockLevel}.`, "warning");
					return;
				}
				state = { ...state, petId: selected.id };
				activePet = selected;
				previousLine = -1;
				persistState();
				react(`${selected.name} is now your active companion!`, "celebrating");
				return;
			}
			if (action) {
				ctx.ui.notify("Usage: /pet, /pet talk, /pet status, /pet feed, /pet play, /pet list, or /pet select <pet-id>", "info");
				return;
			}
			if (ctx.mode !== "tui" || !tui) return;
			hidden = !hidden;
			speech = "";
			animation = "idle";
			clearActivityTimers();
			updateVisibility();
			scheduleSleep();
		},
	});

	pi.registerShortcut("ctrl+\\", { description: "Let your pixel pet talk", handler: talk });
	pi.on("tool_execution_end", (event, ctx) => {
		if (ctx.mode !== "tui" || hidden || prompting || !activePet) return;
		react(event.isError ? "That tool stumbled. We'll debug it together." : "Tool complete! Nice work.", event.isError ? "sad" : "celebrating");
	});
	pi.on("ui_prompt_start", () => { prompting = true; updateVisibility(); });
	pi.on("ui_prompt_end", () => { prompting = false; updateVisibility(); });
	pi.on("session_shutdown", (_event, ctx) => {
		cleanup();
		if (ctx.mode === "tui") ctx.ui.setWidget(WIDGET, undefined);
	});
}
