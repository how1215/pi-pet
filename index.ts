import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { OverlayHandle, TUI } from "@earendil-works/pi-tui";
import { drawLottery, drawPet, gainAffinity, nextJoke, PETS, restorePet, STATE_TYPE } from "./pets.ts";
import type { AnimationState, Pet, PetState } from "./pets.ts";
import { BOTTOM_MARGIN, BUBBLE_WIDTH, canShow, frameDelay, PET_HEIGHT, PET_WIDTH, renderBubble, renderPet } from "./view.ts";

const WIDGET = "session-pet:overlay-owner";
const SLEEP_DELAY = 60_000;
const DRAW_DELAY = 1000;

export default function sessionPet(pi: ExtensionAPI) {
	let tui: TUI | undefined;
	let petHandle: OverlayHandle | undefined;
	let bubbleHandle: OverlayHandle | undefined;
	let bubbleTimer: ReturnType<typeof setTimeout> | undefined;
	let animationTimer: ReturnType<typeof setTimeout> | undefined;
	let sleepTimer: ReturnType<typeof setTimeout> | undefined;
	let drawTimer: ReturnType<typeof setTimeout> | undefined;
	let frameTimer: ReturnType<typeof setTimeout> | undefined;
	let petHidden: boolean | undefined;
	let bubbleHidden: boolean | undefined;
	let hidden = false;
	let prompting = false;
	let animation: AnimationState = "idle";
	let animationFrame = 0;
	let speech = "";
	let previousLine = -1;
	let drawing = false;
	let activePet: Pet | undefined;
	let state: PetState | undefined;

	function visible() {
		return !!tui && !hidden && !prompting && canShow(tui.terminal.columns, tui.terminal.rows);
	}

	function syncAnimation() {
		if (!visible() || animation === "blinking") {
			clearTimeout(frameTimer);
			frameTimer = undefined;
			return;
		}
		if (frameTimer !== undefined) return;
		frameTimer = setTimeout(() => {
			frameTimer = undefined;
			if (!visible()) return;
			animationFrame = (animationFrame + 1) % 2;
			tui?.requestRender();
			syncAnimation();
		}, frameDelay(animation));
	}

	function syncPanels() {
		if (!tui || !canShow(tui.terminal.columns, tui.terminal.rows)) return;
		const nextPetHidden = hidden || prompting;
		const nextBubbleHidden = nextPetHidden || !speech;
		if (petHidden !== nextPetHidden) petHandle?.setHidden(nextPetHidden);
		if (bubbleHidden !== nextBubbleHidden) bubbleHandle?.setHidden(nextBubbleHidden);
		petHidden = nextPetHidden;
		bubbleHidden = nextBubbleHidden;
	}

	function updateVisibility() {
		syncPanels();
		syncAnimation();
		if (visible()) tui?.requestRender();
	}

	function clearActivityTimers() {
		clearTimeout(bubbleTimer);
		clearTimeout(animationTimer);
		clearTimeout(sleepTimer);
		bubbleTimer = animationTimer = sleepTimer = undefined;
	}

	function setAnimation(next: AnimationState) {
		clearTimeout(frameTimer);
		frameTimer = undefined;
		animation = next;
		animationFrame = 0;
		syncAnimation();
	}

	function scheduleSleep() {
		clearTimeout(sleepTimer);
		if (!tui || !activePet) return;
		sleepTimer = setTimeout(() => {
			if (!speech) {
				setAnimation("sleeping");
				updateVisibility();
			}
		}, SLEEP_DELAY);
	}

	function persistState() {
		if (state) pi.appendEntry(STATE_TYPE, { ...state });
	}

	function react(text: string, nextAnimation: AnimationState, duration = 3000) {
		if (!tui || !activePet) return;
		clearActivityTimers();
		speech = text;
		setAnimation(nextAnimation);
		bubbleTimer = setTimeout(() => {
			speech = "";
			setAnimation("idle");
			updateVisibility();
			scheduleSleep();
		}, duration);
		updateVisibility();
	}

	function cleanup() {
		clearActivityTimers();
		clearTimeout(frameTimer);
		clearTimeout(drawTimer);
		frameTimer = drawTimer = undefined;
		drawing = false;
		petHidden = bubbleHidden = undefined;
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
		ctx.ui.setWidget(WIDGET, undefined);
		hidden = prompting = false;
		setAnimation("idle");
		speech = "";
		previousLine = -1;
		const restored = restorePet(ctx.sessionManager.getEntries());
		state = restored ?? drawPet();
		if (!restored) persistState();
		activePet = PETS.find((candidate) => candidate.id === state!.petId)!;

		// A zero-height widget provides the supported TUI factory + disposal hook.
		// Raw non-capturing overlays avoid a permanent custom() prompt/wait state.
		ctx.ui.setWidget(WIDGET, (renderer, theme) => {
			tui = renderer;
			petHandle = renderer.showOverlay({
				render: (width) => renderPet(activePet!, width, theme, animation, animationFrame),
				invalidate() {},
			}, {
				nonCapturing: true,
				anchor: "bottom-right",
				width: PET_WIDTH,
				margin: { right: 2, bottom: BOTTOM_MARGIN },
				visible: canShow,
			});
			let bubbleCache: { text: string; width: number; lines: string[] } | undefined;
			bubbleHandle = renderer.showOverlay({
				render: (width) => {
					if (!bubbleCache || bubbleCache.text !== speech || bubbleCache.width !== width) {
						bubbleCache = { text: speech, width, lines: renderBubble(speech, width, theme) };
					}
					return bubbleCache.lines;
				},
				invalidate() { bubbleCache = undefined; },
			}, {
				nonCapturing: true,
				anchor: "bottom-right",
				width: BUBBLE_WIDTH,
				margin: { right: 2, bottom: BOTTOM_MARGIN + PET_HEIGHT },
				visible: canShow,
			});
			updateVisibility();
			scheduleSleep();
			// Host redraws (including resize) resume a paused loop without polling.
			return { render: () => { syncPanels(); syncAnimation(); return []; }, invalidate() {}, dispose: cleanup };
		});
	});

	function talk(ctx: ExtensionContext) {
		if (ctx.mode !== "tui" || !tui || !activePet || hidden || prompting || drawing) return;
		if (!canShow(tui.terminal.columns, tui.terminal.rows)) {
			ctx.ui.notify("Your pet needs at least 60 columns by 24 rows. Resize the terminal to bring it back.", "info");
			return;
		}
		clearActivityTimers();
		previousLine = nextJoke(previousLine, Math.random, activePet.lines);
		speech = activePet.lines[previousLine];
		setAnimation("blinking");
		animationTimer = setTimeout(() => {
			setAnimation("talking");
			if (visible()) tui?.requestRender();
		}, 180);
		bubbleTimer = setTimeout(() => {
			speech = "";
			setAnimation("idle");
			updateVisibility();
			scheduleSleep();
		}, 5000);
		updateVisibility();
	}

	function train(ctx: ExtensionContext, kind: "feed" | "play") {
		if (ctx.mode !== "tui" || !state || !activePet) return;
		if (drawing) {
			ctx.ui.notify("Wait for the current draw to finish.", "info");
			return;
		}
		const amount = kind === "feed" ? 10 : 15;
		state = gainAffinity(state, amount);
		persistState();
		react(kind === "feed" ? `Crunch! +${amount} affinity.` : `That was fun! +${amount} affinity.`, kind === "feed" ? "eating" : "playing");
	}

	function draw(ctx: ExtensionContext) {
		if (ctx.mode !== "tui" || !tui || !state || !activePet) return;
		if (drawing) {
			ctx.ui.notify("A draw is already in progress.", "info");
			return;
		}
		drawing = true;
		clearActivityTimers();
		speech = "Drawing...";
		setAnimation("drawing");
		updateVisibility();
		drawTimer = setTimeout(() => {
			drawTimer = undefined;
			const previousId = activePet!.id;
			activePet = drawLottery();
			state = { version: 4, petId: activePet.id, affinity: 0 };
			previousLine = -1;
			drawing = false;
			persistState();
			const rarity = activePet.hidden ? "Hidden SSR" : activePet.rarity;
			const message = activePet.id === previousId
				? `${activePet.name} chose to stay with you!`
				: `${rarity} draw: ${activePet.name} is now your companion!`;
			react(message, "celebrating", 4000);
		}, DRAW_DELAY);
	}

	pi.registerCommand("pet", {
		description: "Draw, train, or inspect your pixel pet",
		getArgumentCompletions: (prefix) => {
			const items = ["draw", "talk", "status", "feed", "play", "list"].filter((value) => value.startsWith(prefix));
			return items.length ? items.map((value) => ({ value, label: value })) : null;
		},
		handler: async (args, ctx) => {
			const [action = "", value] = args.trim().toLowerCase().split(/\s+/);
			if (action === "draw" && !value) return draw(ctx);
			if (action === "talk" && !value) return talk(ctx);
			if (action === "feed" && !value) return train(ctx, "feed");
			if (action === "play" && !value) return train(ctx, "play");
			if (action === "status" && !value) {
				if (ctx.mode !== "tui" || !state || !activePet) return;
				ctx.ui.notify(`${activePet.name} | Rarity: ${activePet.hidden ? "Hidden SSR" : activePet.rarity} | Affinity: ${state.affinity}/100 | Animation: ${animation} | Visibility: ${hidden ? "hidden" : "visible"}`, "info");
				return;
			}
			if (action === "list" && !value) {
				if (ctx.mode !== "tui" || !state) return;
				const lines = PETS.map((pet) => {
					const active = pet.id === state!.petId;
					if (pet.hidden && !active) return "??? | Hidden | SSR | 0.3%";
					const chance = `${pet.probability * 100}%`;
					return `${pet.id} | ${pet.name} | ${pet.hidden ? "Hidden SSR" : pet.rarity} | ${chance}${active ? " | active" : ""}`;
				});
				ctx.ui.notify(lines.join("\n"), "info");
				return;
			}
			if (action) {
				ctx.ui.notify("Usage: /pet, /pet draw, /pet talk, /pet status, /pet feed, /pet play, or /pet list", "info");
				return;
			}
			if (ctx.mode !== "tui" || !tui) return;
			hidden = !hidden;
			speech = "";
			setAnimation(drawing ? "drawing" : "idle");
			clearActivityTimers();
			updateVisibility();
			scheduleSleep();
		},
	});

	pi.registerShortcut("ctrl+\\", { description: "Draw a new pixel pet", handler: draw });
	pi.on("tool_execution_end", (event, ctx) => {
		if (ctx.mode !== "tui" || hidden || prompting || !activePet || drawing) return;
		react(event.isError ? "That tool stumbled. We'll debug it together." : "Tool complete! Nice work.", event.isError ? "sad" : "celebrating");
	});
	pi.on("ui_prompt_start", () => { prompting = true; updateVisibility(); });
	pi.on("ui_prompt_end", () => { prompting = false; updateVisibility(); });
	pi.on("session_shutdown", (_event, ctx) => {
		cleanup();
		if (ctx.mode === "tui") ctx.ui.setWidget(WIDGET, undefined);
	});
}
