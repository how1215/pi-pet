import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { OverlayHandle, TUI } from "@earendil-works/pi-tui";
import { drawPet, nextJoke, PETS, restorePet, STATE_TYPE } from "./pets.ts";
import type { AnimationState, Pet } from "./pets.ts";
import { BOTTOM_MARGIN, BUBBLE_WIDTH, canShow, PET_HEIGHT, PET_WIDTH, renderBubble, renderPet } from "./view.ts";

const WIDGET = "session-pet:overlay-owner";

export default function sessionPet(pi: ExtensionAPI) {
	let tui: TUI | undefined;
	let petHandle: OverlayHandle | undefined;
	let bubbleHandle: OverlayHandle | undefined;
	let bubbleTimer: ReturnType<typeof setTimeout> | undefined;
	let animationTimer: ReturnType<typeof setTimeout> | undefined;
	let hidden = false;
	let prompting = false;
	let animation: AnimationState = "idle";
	let speech = "";
	let previousLine = -1;
	let activePet: Pet | undefined;

	function updateVisibility() {
		petHandle?.setHidden(hidden || prompting);
		bubbleHandle?.setHidden(hidden || prompting || !speech);
		tui?.requestRender();
	}

	function cleanup() {
		clearTimeout(bubbleTimer);
		clearTimeout(animationTimer);
		bubbleTimer = animationTimer = undefined;
		petHandle?.hide();
		bubbleHandle?.hide();
		petHandle = bubbleHandle = undefined;
		tui = undefined;
		activePet = undefined;
	}

	pi.on("session_start", (_event, ctx) => {
		cleanup();
		if (ctx.mode !== "tui") return;
		hidden = prompting = false;
		animation = "idle";
		speech = "";
		previousLine = -1;
		let state = restorePet(ctx.sessionManager.getEntries());
		if (!state) {
			state = drawPet();
			pi.appendEntry(STATE_TYPE, state);
		}
		const pet = PETS.find((candidate) => candidate.id === state.petId)!;
		activePet = pet;

		// A zero-height widget provides the supported TUI factory + disposal hook.
		// Raw non-capturing overlays avoid a permanent custom() prompt/wait state.
		ctx.ui.setWidget(WIDGET, (renderer, theme) => {
			tui = renderer;
			petHandle = renderer.showOverlay({
				render: (width) => renderPet(pet, width, theme, animation),
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
			return { render: () => [], invalidate() {}, dispose: cleanup };
		});
	});

	function talk(ctx: ExtensionContext) {
		if (ctx.mode !== "tui" || !tui || hidden || prompting) return;
		if (!canShow(tui.terminal.columns, tui.terminal.rows)) {
			ctx.ui.notify("Your pet needs at least 60 columns by 24 rows. Resize the terminal to bring it back.", "info");
			return;
		}
		if (!activePet) return;
		previousLine = nextJoke(previousLine, Math.random, activePet.lines);
		speech = activePet.lines[previousLine];
		animation = "blinking";
		clearTimeout(bubbleTimer);
		clearTimeout(animationTimer);
		animationTimer = setTimeout(() => {
			animation = "talking";
			tui?.requestRender();
		}, 180);
		bubbleTimer = setTimeout(() => {
			speech = "";
			animation = "idle";
			updateVisibility();
		}, 5000);
		updateVisibility();
	}

	pi.registerCommand("pet", {
		description: "Toggle, talk to, or inspect your pixel pet",
		getArgumentCompletions: (prefix) => {
			const items = ["talk", "status"].filter((value) => value.startsWith(prefix));
			return items.length ? items.map((value) => ({ value, label: value })) : null;
		},
		handler: async (args, ctx) => {
			const action = args.trim().toLowerCase();
			if (action === "talk") {
				talk(ctx);
				return;
			}
			if (action === "status") {
				if (ctx.mode !== "tui" || !activePet) return;
				ctx.ui.notify(`${activePet.name} | Rarity: ${activePet.rarity} | Animation: ${animation} | Visibility: ${hidden ? "hidden" : "visible"}`, "info");
				return;
			}
			if (action) {
				ctx.ui.notify("Usage: /pet, /pet talk, or /pet status", "info");
				return;
			}
			if (ctx.mode !== "tui" || !tui) return;
			hidden = !hidden;
			speech = "";
			animation = "idle";
			clearTimeout(bubbleTimer);
			clearTimeout(animationTimer);
			updateVisibility();
		},
	});
	pi.registerShortcut("ctrl+\\", { description: "Let your pixel pet talk", handler: talk });
	pi.on("ui_prompt_start", () => { prompting = true; updateVisibility(); });
	pi.on("ui_prompt_end", () => { prompting = false; updateVisibility(); });
	pi.on("session_shutdown", (_event, ctx) => {
		cleanup();
		if (ctx.mode === "tui") ctx.ui.setWidget(WIDGET, undefined);
	});
}
