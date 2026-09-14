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
const { PETS, JOKES, drawPet, gainProgress, levelForXp, restorePet, nextJoke, LEGACY_STATE_TYPE, STATE_TYPE } = await jiti.import("../pets.ts");
const { sprite, animationPixels, ANIMATIONS, frameDelay, renderPet, renderBubble, canShow, PET_HEIGHT, PET_WIDTH } = await jiti.import("../view.ts");
const { default: extension } = await jiti.import("../index.ts");
const { visibleWidth, wrapTextWithAnsi, matchesKey, TuiMainScreen } = await import(requirePi.resolve("@earendil-works/pi-tui"));
const theme = { fg: (_name, text) => `\x1b[37m${text}\x1b[0m` };
let checks = 0;
function check(name, fn) { fn(); checks++; console.log(`PASS ${name}`); }

check("eight distinct, padded 16x12 sprites with valid palette keys", () => {
	assert.equal(PETS.length, 8);
	assert.equal(new Set(PETS.map((pet) => pet.pixels.join(""))).size, 8);
	for (const pet of PETS) {
		assert.equal(pet.pixels.length, 12);
		assert.equal(pet.pixels[0], ".".repeat(16));
		assert.equal(pet.pixels[11], ".".repeat(16));
		assert.ok(pet.pixels.every((row) => row[0] === "." && row[15] === "."));
		for (const row of pet.pixels) {
			assert.equal(row.length, 16, `${pet.id}: ${row}`);
			for (const pixel of row) assert.ok(pixel === "." || pixel in pet.palette, pixel);
		}
		for (const animation of ["idle", "blinking", "talking", "sleeping", "celebrating", "sad", "eating", "playing"]) {
			for (const frame of [0, 1]) {
				assert.equal(sprite(pet, animation, frame).length, 6);
				for (const row of sprite(pet, animation, frame)) assert.equal(visibleWidth(row), 16);
			}
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
		for (const animation of ["idle", "blinking", "talking", "sleeping", "celebrating", "sad", "eating", "playing"]) {
			const rendered = renderPet(pet, 34, theme, animation).join("\n");
			assert.ok(rendered.includes(`${pet.name} · ${animation}`), "name and animation label must not be clipped");
			assert.equal(rendered.includes("/pet"), false, "the pet panel must not show command hints");
		}
	}
	for (const file of ["../README.md", "../CHANGELOG.md", "../index.ts", "../pets.ts", "../artwork.ts", "../view.ts"]) {
		assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), "utf8"), /\p{Script=Han}/u, file);
	}
});

check("all sprite states and dialogue fit every width from 1 to 120", () => {
	for (let width = 1; width <= 120; width++) {
		for (const pet of PETS) for (const animation of ["idle", "blinking", "talking", "sleeping", "celebrating", "sad", "eating", "playing"]) for (const frame of [0, 1]) {
			const lines = renderPet(pet, width, theme, animation, frame);
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

check("active animations change pixel geometry instead of only colours", () => {
	for (const pet of PETS) {
		for (const animation of ["idle", "talking", "sleeping", "celebrating", "sad", "eating", "playing"]) {
			assert.notDeepEqual(sprite(pet, animation, 0), sprite(pet, animation, 1), `${pet.id} ${animation}`);
		}
		assert.notDeepEqual(sprite(pet, "blinking", 0), sprite(pet, "idle", 0));
	}
});

check("every face has distinct high-contrast eyes and a separate mouth", () => {
	const area = (pixels, [x, y]) => pixels.slice(y, y + 2).map((row) => row.slice(x, x + 2).join(""));
	for (const pet of PETS) {
		const regions = [...pet.face.eyes, pet.face.mouth];
		const cells = regions.flatMap(([x, y]) => [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]]);
		assert.equal(new Set(cells.map((p) => p.join(":"))).size, 12, pet.id);
		for (const [x, y] of cells) assert.ok(x >= 1 && x <= 14 && y >= 1 && y <= 10);
		assert.equal(pet.palette.e, 232);
		assert.ok(pet.palette.h >= 195);
		const idle = animationPixels(pet, "idle", 0);
		for (const eye of pet.face.eyes) assert.deepEqual(area(idle, eye), ["qe", "ee"]);
		for (const state of ["blinking", "sleeping"]) {
			for (const eye of pet.face.eyes) assert.deepEqual(area(animationPixels(pet, state, 0), eye), ["hh", "ee"]);
		}
		for (const state of ["talking", "eating"]) {
			assert.deepEqual(area(animationPixels(pet, state, 0), pet.face.mouth), ["hh", "mm"]);
			assert.deepEqual(area(animationPixels(pet, state, 1), pet.face.mouth), ["mm", "mp"]);
		}
		for (const state of ["sad", "celebrating", "playing"]) {
			// Pose offsets at frame zero; facial patches move with the body.
			const dx = state === "playing" ? -1 : 0;
			const pixels = animationPixels(pet, state, 0);
			for (const [x, y] of pet.face.eyes) assert.notDeepEqual(area(pixels, [x + dx, y]), ["qe", "ee"]);
		}
	}
});

check("all frames keep the face intact and generate only palette pixels", () => {
	for (const pet of PETS) for (const state of ANIMATIONS) for (const frame of [0, 1]) {
		const pixels = animationPixels(pet, state, frame);
		assert.equal(pixels.length, 12);
		for (const row of pixels) {
			assert.equal(row.length, 16);
			for (const key of row) assert.ok(key === "." || key in pet.palette);
		}
		const dx = state === "playing" ? (frame ? 1 : -1) : 0;
		const dy = ["sad", "sleeping"].includes(state) ? frame : ["idle", "playing", "celebrating"].includes(state) ? -frame : 0;
		for (const [x, y] of [...pet.face.eyes, pet.face.mouth]) {
			for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 2; xx++) {
				assert.notEqual(pixels[y + yy + dy][x + xx + dx], ".", `${pet.id} ${state} face was clipped`);
			}
		}
	}
});

check("sprite cache reuses bounded immutable frames and preserves theme changes", () => {
	for (const pet of PETS) for (const state of ANIMATIONS) {
		const cached = sprite(pet, state, 0);
		assert.ok(Object.isFrozen(cached));
		for (let frame = 0; frame < 100; frame += 2) assert.equal(sprite(pet, state, frame), cached);
	}
	const a = renderPet(PETS[0], PET_WIDTH, theme);
	const b = renderPet(PETS[0], PET_WIDTH, { fg: (_name, text) => `\x1b[32m${text}\x1b[0m` });
	assert.deepEqual(a.slice(0, 6), b.slice(0, 6));
	assert.notEqual(a[6], b[6]);
	assert.equal(frameDelay("idle"), 900);
	assert.equal(frameDelay("sleeping"), 1200);
	assert.equal(frameDelay("eating"), 260);
});

check("rarity buckets keep 60/25/12/3 odds and split evenly by species", () => {
	const counts = Array(8).fill(0);
	for (let i = 0; i < 10000; i++) for (const speciesRoll of [0, 0.99999]) {
		const rolls = [i / 10000, speciesRoll];
		const state = drawPet(() => rolls.shift());
		counts[PETS.findIndex((p) => p.id === state.petId)]++;
	}
	assert.deepEqual(counts, [6000, 2500, 1200, 300, 6000, 2500, 1200, 300]);
	for (const [roll, index] of [[0, 0], [0.6, 1], [0.85, 2], [0.97, 3], [0.99999, 3]]) {
		const rolls = [roll, 0];
		assert.equal(drawPet(() => rolls.shift()).petId, PETS[index].id);
	}
});

check("v2 state restoration validates snapshots and uses the newest valid state", () => {
	const first = drawPet(() => 0.99);
	const latest = gainProgress(first, 125, 20).state;
	const entry = { type: "custom", customType: STATE_TYPE, data: first };
	assert.deepEqual(restorePet([{ ...entry, data: null }, entry]), { state: first, migrated: false });
	assert.equal(restorePet([{ ...entry, data: { ...first, level: 99 } }]), undefined);
	assert.equal(restorePet([{ ...entry, customType: "other" }]), undefined);
	assert.deepEqual(restorePet([entry, { ...entry, data: latest }]), { state: latest, migrated: false });
});

check("v1 state migrates without losing its selected pet", () => {
	const legacy = { version: 1, petId: "kernel-phoenix" };
	const restored = restorePet([{ type: "custom", customType: LEGACY_STATE_TYPE, data: legacy }]);
	assert.equal(restored.migrated, true);
	assert.deepEqual(restored.state, {
		version: 2, petId: "kernel-phoenix", xp: 0, level: 1, affinity: 0,
		unlockedPetIds: ["cache-cat", "queue-rabbit", "kernel-phoenix"],
	});
});

check("old v2 snapshots gain eligible species without losing XP or rare unlocks", () => {
	const old = { version: 2, petId: "kernel-phoenix", xp: 120, level: 2, affinity: 70,
		unlockedPetIds: ["cache-cat", "stack-fox", "kernel-phoenix"] };
	const entry = { type: "custom", customType: STATE_TYPE, data: old };
	const restored = restorePet([entry]);
	assert.equal(restored.migrated, true);
	assert.deepEqual(restored.state, { ...old, unlockedPetIds: [...old.unlockedPetIds, "queue-rabbit", "regex-raccoon"] });
	assert.equal(restorePet([entry, { ...entry, data: restored.state }]).migrated, false);
	assert.deepEqual(old.unlockedPetIds, ["cache-cat", "stack-fox", "kernel-phoenix"]);
});

check("progression calculates levels, caps affinity, and unlocks by level", () => {
	const initial = drawPet(() => 0);
	const result = gainProgress(initial, 450, 150);
	assert.equal(levelForXp(result.state.xp), 5);
	assert.equal(result.state.level, 5);
	assert.equal(result.state.affinity, 100);
	assert.deepEqual(new Set(result.state.unlockedPetIds), new Set(PETS.map((pet) => pet.id)));
	assert.deepEqual(result.unlocked, PETS.filter((pet) => pet.unlockLevel > 1).map((pet) => pet.id));
});

check("dialogue never repeats consecutively in any pet's pool", () => {
	assert.equal(JOKES.length, 32);
	assert.equal(new Set(JOKES).size, 32);
	for (const lines of [JOKES, ...PETS.map((pet) => pet.lines)]) {
		for (let previous = -1; previous < lines.length; previous++) {
			for (const roll of [0, 0.25, 0.5, 0.999999]) {
				const next = nextJoke(previous, () => roll, lines);
				assert.notEqual(next, previous);
				assert.ok(next >= 0 && next < lines.length);
			}
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
let renderRequests = 0;
const renderer = {
	terminal: { columns: 80, rows: 24 },
	requestRender() { renderRequests++; },
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
	check("idle redraws once per 900 ms and reuses the same timer on host redraws", () => {
		const before = renderRequests;
		const pose = overlays[0].component.render(PET_WIDTH);
		for (let i = 0; i < 10; i++) owner.render(80);
		mock.timers.tick(899);
		assert.equal(renderRequests, before);
		mock.timers.tick(1);
		assert.equal(renderRequests, before + 1);
		assert.notDeepEqual(overlays[0].component.render(PET_WIDTH), pose);
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
		assert.ok(overlays[0].component.render(34).join("\n").includes("· idle"));
	});
	shortcuts.get("ctrl+\\").handler(ctx);
	await commands.get("pet").handler("", ctx);
	check("/pet hides pet and speech; shortcut and prompts cannot reopen it", () => {
		assert.equal(overlays[0].hidden, true);
		assert.equal(overlays[1].hidden, true);
		shortcuts.get("ctrl+\\").handler(ctx);
		emit("ui_prompt_start"); emit("ui_prompt_end");
		const before = renderRequests;
		mock.timers.tick(6000);
		assert.equal(renderRequests, before);
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
	const initialState = entries[0].data;
	const initialPet = PETS.find((pet) => pet.id === initialState.petId);
	check("/pet talk uses the active pet's dedicated dialogue", () => {
		const bubble = overlays[1].component.render(38).join("\n")
			.replace(/\x1b\[[0-9;]*m/g, "").replace(/[╭─╮│╰┬╯]/g, " ").replace(/\s+/g, " ");
		assert.ok(initialPet.lines.some((line) => bubble.includes(line)));
		assert.equal(overlays[1].hidden, false);
	});
	await commands.get("pet").handler("feed", ctx);
	check("/pet feed persists XP and affinity with an eating reaction", () => {
		assert.deepEqual(entries.at(-1).data, { ...initialState, xp: 15, affinity: 10 });
		assert.notDeepEqual(overlays[0].component.render(22), renderPet(initialPet, 22, theme, "idle"));
	});
	await commands.get("pet").handler("play", ctx);
	check("/pet play adds its progression snapshot", () => {
		assert.equal(entries.at(-1).data.xp, 40);
		assert.equal(entries.at(-1).data.affinity, 25);
	});
	await commands.get("pet").handler("status", ctx);
	check("/pet status reports progression, animation, and visibility", () => {
		assert.equal(notifications.at(-1).message, `${initialPet.name} | Rarity: ${initialPet.rarity} | Level: 1 | XP: 40 (40/100) | Affinity: 25/100 | Animation: playing | Visibility: visible`);
		assert.deepEqual(commands.get("pet").getArgumentCompletions("f"), [{ value: "feed", label: "feed" }]);
	});
	await commands.get("pet").handler("list", ctx);
	check("/pet list shows the complete collection and lock state", () => {
		for (const pet of PETS) assert.match(notifications.at(-1).message, new RegExp(`${pet.id} \\| ${pet.name}`));
	});
	const lockedPet = PETS.find((pet) => !entries.at(-1).data.unlockedPetIds.includes(pet.id));
	await commands.get("pet").handler(`select ${lockedPet.id}`, ctx);
	check("/pet select rejects locked pets", () => {
		assert.equal(entries.at(-1).data.petId, initialPet.id);
		assert.equal(notifications.at(-1).level, "warning");
	});
	for (let index = 0; index < 15; index++) await commands.get("pet").handler("play", ctx);
	await commands.get("pet").handler("select kernel-phoenix", ctx);
	check("training unlocks pets and /pet select switches the rendered companion", () => {
		assert.equal(entries.at(-1).data.level, 5);
		assert.deepEqual(new Set(entries.at(-1).data.unlockedPetIds), new Set(PETS.map((pet) => pet.id)));
		assert.equal(entries.at(-1).data.petId, "kernel-phoenix");
		assert.ok(overlays[0].component.render(22).join("\n").includes("Kernel Phoenix"));
		assert.deepEqual(commands.get("pet").getArgumentCompletions("select k"), [{ value: "select kernel-phoenix", label: "select kernel-phoenix" }]);
	});
	events.get("tool_execution_end")({ isError: false }, ctx);
	check("successful tools trigger the celebrating animation", () => {
		assert.notDeepEqual(overlays[0].component.render(22), renderPet(PETS[3], 22, theme, "idle"));
	});
	events.get("tool_execution_end")({ isError: true }, ctx);
	await commands.get("pet").handler("status", ctx);
	check("failed tools trigger the sad animation", () => {
		assert.match(notifications.at(-1).message, /Animation: sad/);
	});
	mock.timers.tick(3000);
	mock.timers.tick(60000);
	await commands.get("pet").handler("status", ctx);
	check("the pet sleeps after inactivity", () => {
		assert.match(notifications.at(-1).message, /Animation: sleeping/);
	});
	await commands.get("pet").handler("hide", ctx);
	check("unknown subcommands show usage without changing visibility", () => {
		assert.equal(overlays[0].hidden, false);
		assert.match(notifications.at(-1).message, /^Usage: \/pet/);
	});
	check("temporary prompts pause redraws and resume the sleeping timer", () => {
		emit("ui_prompt_start"); assert.equal(overlays[0].hidden, true);
		const paused = renderRequests;
		mock.timers.tick(5000);
		assert.equal(renderRequests, paused);
		emit("ui_prompt_end"); assert.equal(overlays[0].hidden, false);
		const resumed = renderRequests;
		mock.timers.tick(1199);
		assert.equal(renderRequests, resumed);
		mock.timers.tick(1);
		assert.equal(renderRequests, resumed + 1);
	});
	check("small terminals stop redraws; host resize resumes without polling", () => {
		renderer.terminal.columns = 40;
		owner.render(40);
		const before = renderRequests;
		mock.timers.tick(10000);
		assert.equal(renderRequests, before);
		renderer.terminal.columns = 80;
		owner.render(80);
		mock.timers.tick(1200);
		assert.equal(renderRequests, before + 1);
	});
	check("shutdown/reload disposes both overlays and pending timers, no reroll", () => {
		const saved = structuredClone(entries);
		shortcuts.get("ctrl+\\").handler(ctx);
		emit("session_shutdown");
		assert.ok(overlays.every((overlay) => overlay.removed));
		const before = renderRequests;
		mock.timers.tick(120000);
		assert.equal(renderRequests, before);
		emit("session_start");
		assert.deepEqual(entries, saved);
	});
	for (const pet of PETS.slice(4)) {
		await commands.get("pet").handler(`select ${pet.id}`, ctx);
		await commands.get("pet").handler("talk", ctx);
		check(`${pet.name} can be selected and speaks only its own dialogue`, () => {
			assert.equal(entries.at(-1).data.petId, pet.id);
			const bubble = overlays.at(-1).component;
			const lines = bubble.render(38);
			const text = lines.join(" ").replace(/\x1b\[[0-9;]*m/g, "").replace(/[╭─╮│╰┬╯]/g, " ").replace(/\s+/g, " ");
			assert.ok(pet.lines.some((line) => text.includes(line)));
			assert.equal(bubble.render(38), lines);
			bubble.invalidate();
			assert.notEqual(bubble.render(38), lines);
		});
	}
	check("pending speech expiry cannot redraw while a prompt or small terminal hides it", () => {
		for (const reason of ["prompt", "resize"]) {
			shortcuts.get("ctrl+\\").handler(ctx);
			if (reason === "prompt") emit("ui_prompt_start");
			else { renderer.terminal.rows = 15; owner.render(80); }
			const before = renderRequests;
			mock.timers.tick(180);
			mock.timers.tick(5000);
			mock.timers.tick(60000);
			assert.equal(renderRequests, before);
			if (reason === "prompt") emit("ui_prompt_end");
			else { renderer.terminal.rows = 24; owner.render(80); }
		}
	});
	check("legacy unlock repair is persisted once across repeated startup", () => {
		emit("session_shutdown");
		entries = [{ type: "custom", customType: STATE_TYPE, data: {
			version: 2, petId: "stack-fox", xp: 100, level: 2, affinity: 40,
			unlockedPetIds: ["cache-cat", "stack-fox"],
		} }];
		emit("session_start");
		assert.equal(entries.length, 2);
		assert.ok(entries[1].data.unlockedPetIds.includes("regex-raccoon"));
		assert.equal(entries[1].data.xp, 100);
		emit("session_start");
		assert.equal(entries.length, 2);
		const before = renderRequests;
		mock.timers.tick(900);
		assert.equal(renderRequests, before + 1);
	});
	check("new session creates its own entry; print/RPC modes do nothing", () => {
		emit("session_shutdown"); entries = [];
		emit("session_start"); assert.equal(entries.length, 1);
		emit("session_shutdown");
		for (const mode of ["print", "rpc", "json"]) {
			ctx.mode = mode; entries = []; emit("session_start");
			assert.equal(entries.length, 0);
			const before = renderRequests;
			mock.timers.tick(120000);
			assert.equal(renderRequests, before);
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
		nonCapturing: true, anchor: "bottom-right", width: PET_WIDTH, margin: { bottom: 4, right: 2 }, visible: canShow,
	});
	try {
		assert.equal(editor.focused, true); assert.equal(pet.isFocused(), false);
		tui.renderNow();
		const bounds = pet.getBounds();
		assert.ok(bounds); assert.equal(bounds.width, PET_WIDTH); assert.equal(bounds.height, PET_HEIGHT);
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
