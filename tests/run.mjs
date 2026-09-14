// npm test; optionally pass an installed pi-coding-agent package directory.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { mock } from "node:test";
import { fileURLToPath } from "node:url";

const piRoot = process.argv[2] ?? resolve(dirname(fileURLToPath(import.meta.resolve("@earendil-works/pi-coding-agent"))), "..");
const requirePi = createRequire(resolve(piRoot, "package.json"));
const { createJiti } = requirePi("jiti");
const jiti = createJiti(import.meta.url, {
	alias: { "@earendil-works/pi-tui": requirePi.resolve("@earendil-works/pi-tui") },
});
const { PETS, JOKES, drawPet, restorePet, nextJoke, STATE_TYPE } = await jiti.import("../pets.ts");
const { sprite, renderPet, renderBubble, canShow, PET_HEIGHT } = await jiti.import("../view.ts");
const { default: extension } = await jiti.import("../index.ts");
const { visibleWidth, wrapTextWithAnsi, matchesKey, TuiMainScreen } = await import(requirePi.resolve("@earendil-works/pi-tui"));
const theme = { fg: (_name, text) => `\x1b[37m${text}\x1b[0m` };
let checks = 0;
function check(name, fn) { fn(); checks++; console.log(`PASS ${name}`); }

check("four distinct, rectangular 16x12 sprites with valid palette keys", () => {
	assert.equal(new Set(PETS.map((pet) => pet.pixels.join(""))).size, 4);
	for (const pet of PETS) {
		assert.equal(pet.pixels.length, 12);
		for (const row of pet.pixels) {
			assert.equal(row.length, 16, `${pet.id}: ${row}`);
			for (const pixel of row) assert.ok(pixel === "." || pixel in pet.palette, pixel);
		}
		for (const animation of ["idle", "blinking", "talking"]) {
			assert.equal(sprite(pet, animation).length, 6);
			for (const row of sprite(pet, animation)) assert.equal(visibleWidth(row), 16);
		}
		assert.equal(pet.lines.length, 4);
		assert.equal(new Set(pet.lines).size, pet.lines.length);
	}
});

check("English content and complete pet labels at the standard width", () => {
	for (const text of [...PETS.map((pet) => pet.name), ...JOKES]) {
		assert.match(text, /^[\x20-\x7e]+$/, "names and jokes must use printable English text");
	}
	for (const pet of PETS) {
		const rendered = renderPet(pet, 22, theme).join("\n");
		assert.ok(rendered.includes(pet.name), "English labels must not be clipped");
		assert.equal(rendered.includes("/pet"), false, "the pet panel must not show command hints");
	}
	for (const file of ["../README.md", "../index.ts", "../pets.ts", "../view.ts"]) {
		assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), "utf8"), /\p{Script=Han}/u, file);
	}
});

check("all sprite states and jokes fit every width from 1 to 120", () => {
	for (let width = 1; width <= 120; width++) {
		for (const pet of PETS) for (const animation of ["idle", "blinking", "talking"]) {
			const lines = renderPet(pet, width, theme, animation);
			assert.equal(lines.length, PET_HEIGHT);
			for (const line of lines) assert.equal(visibleWidth(line), width);
		}
		for (const joke of JOKES) {
			for (const line of renderBubble(joke, width, theme)) assert.equal(visibleWidth(line), width);
		}
	}
	for (const joke of JOKES) {
		assert.ok(wrapTextWithAnsi(joke, 34).length <= 4, "normal-width bubbles must not truncate jokes");
		assert.ok(renderBubble(joke, 38, theme).length <= 6);
	}
	assert.deepEqual(renderPet(PETS[0], 0, theme), []);
});

check("rarity thresholds and exact 60/25/12/3 weighted allocation", () => {
	const counts = [0, 0, 0, 0];
	for (let i = 0; i < 10000; i++) counts[PETS.findIndex((p) => p.id === drawPet(() => i / 10000).petId)]++;
	assert.deepEqual(counts, [6000, 2500, 1200, 300]);
	for (const [roll, index] of [[0, 0], [0.6, 1], [0.85, 2], [0.97, 3], [0.99999, 3]]) {
		assert.equal(drawPet(() => roll).petId, PETS[index].id);
	}
});

check("state restoration validates data and ignores unrelated entries", () => {
	const state = drawPet(() => 0.99);
	const entry = { type: "custom", customType: STATE_TYPE, data: state };
	assert.deepEqual(restorePet([{ ...entry, data: null }, entry]), state);
	assert.equal(restorePet([{ ...entry, data: { version: 1, petId: "missing" } }]), undefined);
	assert.equal(restorePet([{ ...entry, customType: "other" }]), undefined);
	assert.deepEqual(restorePet([entry, { ...entry, data: drawPet(() => 0) }]), state);
});

check("jokes never repeat consecutively, including random endpoints", () => {
	for (let previous = -1; previous < JOKES.length; previous++) {
		for (const roll of [0, 0.25, 0.5, 0.999999]) {
			const next = nextJoke(previous, () => roll);
			assert.notEqual(next, previous);
			assert.ok(next >= 0 && next < JOKES.length);
		}
	}
});

check("responsive cutoff and Terminal.app Ctrl+backslash input", () => {
	assert.equal(canShow(59, 24), false);
	assert.equal(canShow(60, 23), false);
	assert.equal(canShow(60, 24), true);
	assert.equal(matchesKey("\x1c", "ctrl+\\"), true);
});

const events = new Map();
const commands = new Map();
const shortcuts = new Map();
let entries = [];
let owner;
const notifications = [];
const overlays = [];
const renderer = {
	terminal: { columns: 80, rows: 24 },
	requestRender() {},
	showOverlay(component, options) {
		assert.equal(options.nonCapturing, true);
		const overlay = { component, options, hidden: false, removed: false,
			setHidden(hidden) { this.hidden = hidden; }, hide() { this.removed = true; } };
		overlays.push(overlay);
		return overlay;
	},
};
const ctx = {
	mode: "tui",
	sessionManager: { getEntries: () => entries },
	ui: {
		setWidget(_key, factory) { owner?.dispose(); owner = factory?.(renderer, theme); },
		notify(message, level) { notifications.push({ message, level }); },
	},
};
extension({
	on: (name, handler) => events.set(name, handler),
	registerCommand: (name, command) => commands.set(name, command),
	registerShortcut: (key, shortcut) => shortcuts.set(key, shortcut),
	appendEntry: (customType, data) => entries.push({ type: "custom", customType, data }),
});
const emit = (name) => events.get(name)({}, ctx);

mock.timers.enable({ apis: ["setTimeout"] });
try {
	check("session startup persists once; widget takes zero lines", () => {
		emit("session_start");
		assert.equal(entries.length, 1);
		assert.deepEqual(owner.render(80), []);
		assert.equal(overlays.length, 2);
		assert.equal(overlays[0].hidden, false);
		assert.equal(overlays[1].hidden, true);
	});
	check("shortcut runs blinking, talking, and idle animation states", () => {
		const idle = overlays[0].component.render(22);
		shortcuts.get("ctrl+\\").handler(ctx);
		assert.equal(overlays[1].hidden, false);
		const blinking = overlays[0].component.render(22);
		assert.notDeepEqual(blinking, idle);
		mock.timers.tick(180);
		const talking = overlays[0].component.render(22);
		assert.notDeepEqual(talking, blinking);
		mock.timers.tick(3820);
		shortcuts.get("ctrl+\\").handler(ctx);
		mock.timers.tick(1000);
		assert.equal(overlays[1].hidden, false);
		mock.timers.tick(4000);
		assert.equal(overlays[1].hidden, true);
		assert.deepEqual(overlays[0].component.render(22), idle);
	});
	shortcuts.get("ctrl+\\").handler(ctx);
	await commands.get("pet").handler("", ctx);
	check("/pet hides pet and speech; shortcut and prompts cannot reopen it", () => {
		assert.equal(overlays[0].hidden, true);
		assert.equal(overlays[1].hidden, true);
		shortcuts.get("ctrl+\\").handler(ctx);
		emit("ui_prompt_start"); emit("ui_prompt_end");
		mock.timers.tick(6000);
		assert.equal(overlays[0].hidden, true);
		assert.equal(overlays[1].hidden, true);
	});
	await commands.get("pet").handler("", ctx);
	check("/pet restores the same pet without speaking", () => {
		assert.equal(overlays[0].hidden, false);
		assert.equal(overlays[1].hidden, true);
		assert.equal(entries.length, 1);
	});
	await commands.get("pet").handler("talk", ctx);
	const activePet = PETS.find((pet) => pet.id === entries[0].data.petId);
	check("/pet talk uses the active pet's dedicated dialogue", () => {
		const bubble = overlays[1].component.render(38).join("\n")
			.replace(/\x1b\[[0-9;]*m/g, "").replace(/[╭─╮│╰┬╯]/g, " ").replace(/\s+/g, " ");
		assert.ok(activePet.lines.some((line) => bubble.includes(line)));
		assert.equal(overlays[1].hidden, false);
	});
	await commands.get("pet").handler("status", ctx);
	check("/pet status reports identity, rarity, animation, and visibility", () => {
		assert.equal(notifications.at(-1).message, `${activePet.name} | Rarity: ${activePet.rarity} | Animation: blinking | Visibility: visible`);
		assert.deepEqual(commands.get("pet").getArgumentCompletions("t"), [{ value: "talk", label: "talk" }]);
	});
	await commands.get("pet").handler("hide", ctx);
	check("unknown subcommands show usage without changing visibility", () => {
		assert.equal(overlays[0].hidden, false);
		assert.equal(notifications.at(-1).message, "Usage: /pet, /pet talk, or /pet status");
	});
	check("temporary prompts hide and restore pet", () => {
		emit("ui_prompt_start"); assert.equal(overlays[0].hidden, true);
		emit("ui_prompt_end"); assert.equal(overlays[0].hidden, false);
	});
	check("shutdown/reload disposes both overlays and pending timers, no reroll", () => {
		const saved = structuredClone(entries);
		shortcuts.get("ctrl+\\").handler(ctx);
		emit("session_shutdown");
		assert.ok(overlays.every((overlay) => overlay.removed));
		mock.timers.tick(10000);
		emit("session_start");
		assert.deepEqual(entries, saved);
	});
	check("new session creates its own entry; print/RPC modes do nothing", () => {
		emit("session_shutdown"); entries = [];
		emit("session_start"); assert.equal(entries.length, 1);
		emit("session_shutdown");
		for (const mode of ["print", "rpc", "json"]) {
			ctx.mode = mode; entries = []; emit("session_start");
			assert.equal(entries.length, 0);
		}
	});
} finally { mock.timers.reset(); }

check("real regular-mode TUI keeps editor focus with passive overlays", () => {
	const terminal = {
		columns: 80, rows: 24, write() {}, hideCursor() {}, showCursor() {},
		start() {}, stop() {}, moveBy() {}, clearLine() {}, clearFromCursor() {}, clearScreen() {},
	};
	const tui = new TuiMainScreen(terminal);
	const editor = { focused: false, render: () => ["> draft"], invalidate() {} };
	tui.addChild(editor); tui.setFocus(editor);
	const pet = tui.showOverlay({ render: (w) => renderPet(PETS[0], w, theme), invalidate() {} }, {
		nonCapturing: true, anchor: "bottom-right", width: 22, margin: { bottom: 4, right: 2 }, visible: canShow,
	});
	try {
		assert.equal(editor.focused, true); assert.equal(pet.isFocused(), false);
		tui.renderNow();
		const bounds = pet.getBounds();
		assert.ok(bounds); assert.equal(bounds.width, 22); assert.equal(bounds.height, PET_HEIGHT);
		for (const [columns, rows] of [[60, 24], [40, 15], [120, 40], [80, 24]]) {
			terminal.columns = columns; terminal.rows = rows; tui.renderNow(true);
			assert.equal(editor.focused, true);
			const box = pet.getBounds();
			if (box) { assert.ok(box.col + box.width <= columns); assert.ok(box.row + box.height <= rows); }
		}
		pet.setHidden(true); pet.setHidden(false); pet.hide();
		assert.equal(editor.focused, true);
	} finally { tui.stop(); }
});
const { loadExtensions } = await import(resolve(piRoot, "dist/core/extensions/loader.js"));
const loaded = await loadExtensions([resolve(import.meta.dirname, "../index.ts")], process.cwd());
check("pi's actual TypeScript extension loader registers plugin without errors", () => {
	assert.deepEqual(loaded.errors, []);
	assert.equal(loaded.extensions.length, 1);
	assert.ok(loaded.extensions[0].commands.has("pet"));
	assert.ok(loaded.extensions[0].shortcuts.has("ctrl+\\"));
	assert.equal(loaded.extensions[0].shortcuts.has("ctrl+/"), false);
});
console.log(`\n${checks} checks passed.`);
