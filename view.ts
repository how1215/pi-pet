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

function animationPixels(pet: Pet, animation: AnimationState, frame: number): string[][] {
	let pixels = pet.pixels.map((row) => [...row]);
	const shifted = (dx: number, dy: number) => {
		const next = Array.from({ length: 12 }, () => Array(16).fill("."));
		for (let y = 0; y < 12; y++) for (let x = 0; x < 16; x++) {
			const nx = x + dx;
			const ny = y + dy;
			if (nx >= 0 && nx < 16 && ny >= 0 && ny < 12) next[ny][nx] = pixels[y][x];
		}
		pixels = next;
	};
	const moveEyesDown = () => {
		for (let y = 10; y >= 0; y--) for (let x = 0; x < 16; x++) if (pixels[y][x] === "e") {
			pixels[y][x] = ".";
			pixels[y + 1][x] = "o";
		}
	};

	if (animation === "idle" && frame % 2 === 1) shifted(0, -1);
	if (animation === "blinking") moveEyesDown();
	if (animation === "talking") pixels[6][frame % 2 === 0 ? 7 : 8] = frame % 2 === 0 ? "o" : ".";
	if (animation === "sleeping") {
		moveEyesDown();
		shifted(0, frame % 2 === 0 ? 1 : 0);
		pixels[frame % 2][14] = "a";
	}
	if (animation === "celebrating") {
		shifted(0, frame % 2 === 0 ? -1 : 0);
		pixels[frame % 2][0] = "a";
		pixels[(frame + 1) % 2][15] = "a";
	}
	if (animation === "sad") {
		moveEyesDown();
		shifted(frame % 2 === 0 ? 0 : -1, 1);
	}
	if (animation === "eating") {
		pixels[5 + frame % 2][14] = "a";
		pixels[7 - frame % 2][15] = frame % 2 === 0 ? "a" : ".";
	}
	if (animation === "playing") shifted(frame % 2 === 0 ? -1 : 1, frame % 2 === 0 ? -1 : 0);
	return pixels;
}

// Two vertical pixels per cell. Explicit colour resets prevent colour leakage
// into the editor; no emoji, combining characters, or terminal cursor escapes.
export function sprite(pet: Pet, animation: AnimationState = "idle", frame = 0): string[] {
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
