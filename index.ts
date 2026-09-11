import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { OverlayHandle, TUI } from "@earendil-works/pi-tui";
import { drawPet, JOKES, nextJoke, PETS, restorePet, STATE_TYPE } from "./pets.ts";
import { BOTTOM_MARGIN, BUBBLE_WIDTH, canShow, PET_HEIGHT, PET_WIDTH, renderBubble, renderPet } from "./view.ts";

const WIDGET = "session-pet:overlay-owner";

export default function sessionPet(pi: ExtensionAPI) {
	let tui: TUI | undefined;
	let petHandle: OverlayHandle | undefined;
	let bubbleHandle: OverlayHandle | undefined;
	let bubbleTimer: ReturnType<typeof setTimeout> | undefined;
	let blinkTimer: ReturnType<typeof setTimeout> | undefined;
	let hidden = false;
	let prompting = false;
	let blink = false;
	let speech = "";
	let previousJoke = -1;

	function updateVisibility() {
		petHandle?.setHidden(hidden || prompting);
		bubbleHandle?.setHidden(hidden || prompting || !speech);
		tui?.requestRender();
	}

	function cleanup() {
		clearTimeout(bubbleTimer);
		clearTimeout(blinkTimer);
		bubbleTimer = blinkTimer = undefined;
		petHandle?.hide();
		bubbleHandle?.hide();
		petHandle = bubbleHandle = undefined;
		tui = undefined;
	}

	pi.on("session_start", (_event, ctx) => {
		cleanup();
		if (ctx.mode !== "tui") return;
		hidden = prompting = blink = false;
		speech = "";
		previousJoke = -1;
		let state = restorePet(ctx.sessionManager.getEntries());
		if (!state) {
			state = drawPet();
			pi.appendEntry(STATE_TYPE, state);
		}
		const pet = PETS.find((candidate) => candidate.id === state.petId)!;

		// A zero-height widget provides the supported TUI factory + disposal hook.
		// Raw non-capturing overlays avoid a permanent custom() prompt/wait state.
		ctx.ui.setWidget(WIDGET, (renderer, theme) => {
			tui = renderer;
			petHandle = renderer.showOverlay({
				render: (width) => renderPet(pet, width, theme, blink),
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
		previousJoke = nextJoke(previousJoke);
		speech = JOKES[previousJoke];
		blink = true;
		clearTimeout(bubbleTimer);
		clearTimeout(blinkTimer);
		blinkTimer = setTimeout(() => {
			blink = false;
			tui?.requestRender();
		}, 180);
		bubbleTimer = setTimeout(() => {
			speech = "";
			updateVisibility();
		}, 5000);
		updateVisibility();
	}

	pi.registerCommand("pet", {
		description: "Toggle your pixel pet; press Ctrl+\\ for a CS joke",
		handler: async (args, ctx) => {
			if (args.trim()) {
				ctx.ui.notify("Usage: /pet to toggle visibility; Ctrl+\\ to interact", "info");
				return;
			}
			if (ctx.mode !== "tui" || !tui) return;
			hidden = !hidden;
			speech = "";
			blink = false;
			clearTimeout(bubbleTimer);
			clearTimeout(blinkTimer);
			updateVisibility();
		},
	});
	pi.registerShortcut("ctrl+\\", { description: "Let your pixel pet tell a CS joke", handler: talk });
	pi.on("ui_prompt_start", () => { prompting = true; updateVisibility(); });
	pi.on("ui_prompt_end", () => { prompting = false; updateVisibility(); });
	pi.on("session_shutdown", (_event, ctx) => {
		cleanup();
		if (ctx.mode === "tui") ctx.ui.setWidget(WIDGET, undefined);
	});
}
