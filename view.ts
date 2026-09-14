import type { Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import type { AnimationState, Pet } from "./pets.ts";

export const PET_WIDTH = 34;
export const BUBBLE_WIDTH = 38;
export const BOTTOM_MARGIN = 4;
export const PET_HEIGHT = 7;
export const canShow = (width: number, height: number): boolean => width >= 60 && height >= 24;

function fit(text: string, width: number): string {
	return truncateToWidth(text, Math.max(0, width), "", true);
}

function centered(text: string, width: number): string {
	const padding = Math.max(0, Math.floor((width - visibleWidth(text)) / 2));
	return fit(" ".repeat(padding) + text, width);
}

export const ANIMATIONS: readonly AnimationState[] = ["idle", "blinking", "talking", "sleeping", "celebrating", "sad", "eating", "playing", "drawing"];
export const frameDelay = (animation: AnimationState): number => animation === "idle" ? 900 : animation === "sleeping" ? 1200 : animation === "drawing" ? 140 : 260;

// Exported for visual previews and tests of actual facial geometry.
export function animationPixels(pet: Pet, animation: AnimationState, frame: number): string[][] {
	const phase = frame % 2;
	let pixels = pet.pixels.map((row) => [...row]);
	const patch = ([x, y]: readonly [number, number], rows: readonly string[]) => {
		rows.forEach((row, dy) => [...row].forEach((pixel, dx) => { pixels[y + dy][x + dx] = pixel; }));
	};
	const happy = animation === "playing" || animation === "celebrating";
	const closed = animation === "blinking" || animation === "sleeping";
	pet.face.eyes.forEach((point, index) => {
		const eye = closed ? ["hh", "ee"] : happy ? (index ? ["eh", "he"] : ["he", "eh"])
			: animation === "sad" ? (index ? ["ee", "eh"] : ["ee", "he"]) : ["qe", "ee"];
		patch(point, eye);
	});
	let mouth = ["hh", "mm"];
	if (happy) mouth = ["mm", "pp"];
	if ((animation === "talking" || animation === "eating") && phase === 1) mouth = ["mm", "mp"];
	if (animation === "sad") mouth = ["mm", "hh"];
	patch(pet.face.mouth, mouth);
	if (phase === 1 && !closed && animation !== "sad") {
		for (const [x, y, pixel] of pet.motion) pixels[y][x] = pixel;
	}
	// Move the complete face with the body; the padded silhouettes never clip.
	const dx = animation === "playing" ? (phase ? 1 : -1) : 0;
	const dy = animation === "sleeping" || animation === "sad" ? phase
		: animation === "playing" || animation === "celebrating" || animation === "idle" ? -phase : 0;
	if (dx || dy) {
		const moved = Array.from({ length: 12 }, () => Array<string>(16).fill("."));
		for (let y = 1; y < 11; y++) for (let x = 1; x < 15; x++) moved[y + dy][x + dx] = pixels[y][x];
		pixels = moved;
	}
	if (animation === "eating") {
		const [x, y] = pet.face.mouth;
		pixels[y + phase][x + 3] = "a";
		pixels[y + 1 - phase][x + 4] = "a";
	}
	if (animation === "celebrating") {
		pixels[1 + phase][0] = "a";
		pixels[2 - phase][15] = "a";
	}
	if (animation === "sleeping") {
		patch([13, 1 + phase], ["aa", ".a", "aa"]);
	}
	if (animation === "drawing") {
		const row = 2 + phase * 6;
		pixels[row][0] = pixels[row][15] = "a";
		pixels[row + 1][phase ? 2 : 13] = "q";
		const segment = pixels[9].slice(3, 13);
		for (let x = 3; x < 13; x++) pixels[9][x] = segment[(x - 3 + (phase ? 2 : 8)) % segment.length];
	}
	return pixels;
}

// At most 9 states x 2 frames per pet. No theme-dependent colours in this cache.
const spriteCache = new WeakMap<Pet, Map<string, readonly string[]>>();

// Two vertical pixels per cell. Explicit colour resets prevent colour leakage
// into the editor; no emoji, combining characters, or terminal cursor escapes.
export function sprite(pet: Pet, animation: AnimationState = "idle", frame = 0): readonly string[] {
	let cache = spriteCache.get(pet);
	if (!cache) { cache = new Map(); spriteCache.set(pet, cache); }
	const key = `${animation}:${frame % 2}`;
	const cached = cache.get(key);
	if (cached) return cached;
	const palette = pet.palette as Record<string, number>;
	const pixels = animationPixels(pet, animation, frame);
	const colour = (pixel: string): number | undefined => palette[pixel];
	const lines: string[] = [];
	for (let y = 0; y < pixels.length; y += 2) {
		let line = "";
		for (let x = 0; x < 16; x++) {
			const top = colour(pixels[y][x]);
			const bottom = colour(pixels[y + 1][x]);
			if (top === undefined && bottom === undefined) line += " ";
			else if (top === undefined) line += `\x1b[38;5;${bottom}m▄\x1b[0m`;
			else if (bottom === undefined) line += `\x1b[38;5;${top}m▀\x1b[0m`;
			else line += `\x1b[38;5;${top};48;5;${bottom}m▀\x1b[0m`;
		}
		lines.push(line);
	}
	cache.set(key, Object.freeze(lines));
	return lines;
}

export function renderPet(pet: Pet, width: number, theme: Theme, animation: AnimationState = "idle", frame = 0): string[] {
	if (width <= 0) return [];
	const badgeColour = pet.palette.a;
	return [
		...sprite(pet, animation, frame).map((line) => centered(line, width)),
		centered(`\x1b[38;5;${badgeColour}m${pet.rarity}\x1b[0m ${theme.fg("text", `${pet.name} · ${animation}`)}`, width),
	];
}

export function renderBubble(text: string, width: number, theme: Theme): string[] {
	if (width < 8) return [fit(text, width)];
	const inside = width - 4;
	const wrapped = wrapTextWithAnsi(text, inside);
	const lines = wrapped.slice(0, 4);
	if (wrapped.length > 4) lines[3] = truncateToWidth(lines[3], inside - 3, "") + "...";
	const border = (value: string) => theme.fg("borderAccent", value);
	return [
		border(`╭${"─".repeat(width - 2)}╮`),
		...lines.map((line) => border("│ ") + theme.fg("text", fit(line, inside)) + border(" │")),
		border(`╰${"─".repeat(width - 8)}┬${"─".repeat(5)}╯`),
	].map((line) => fit(line, width));
}
