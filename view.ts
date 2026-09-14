import type { Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import type { AnimationState, Pet } from "./pets.ts";

export const PET_WIDTH = 22;
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

// Two vertical pixels per cell. Explicit colour resets prevent colour leakage
// into the editor; no emoji, combining characters, or terminal cursor escapes.
export function sprite(pet: Pet, animation: AnimationState = "idle"): string[] {
	const palette = pet.palette as Record<string, number>;
	const colour = (pixel: string): number | undefined => {
		if ((animation === "blinking" || animation === "sleeping") && pixel === "e") return palette.s;
		if ((animation === "talking" || animation === "eating") && pixel === "p") return palette.a;
		if ((animation === "celebrating" || animation === "playing") && (pixel === "p" || pixel === "h")) return palette.a;
		if (animation === "sad" && (pixel === "e" || pixel === "p")) return palette.s;
		return palette[pixel];
	};
	const lines: string[] = [];
	for (let y = 0; y < pet.pixels.length; y += 2) {
		let line = "";
		for (let x = 0; x < 16; x++) {
			const top = colour(pet.pixels[y][x]);
			const bottom = colour(pet.pixels[y + 1][x]);
			if (top === undefined && bottom === undefined) line += " ";
			else if (top === undefined) line += `\x1b[38;5;${bottom}m▄\x1b[0m`;
			else if (bottom === undefined) line += `\x1b[38;5;${top}m▀\x1b[0m`;
			else line += `\x1b[38;5;${top};48;5;${bottom}m▀\x1b[0m`;
		}
		lines.push(line);
	}
	return lines;
}

export function renderPet(pet: Pet, width: number, theme: Theme, animation: AnimationState = "idle"): string[] {
	if (width <= 0) return [];
	const badgeColour = pet.palette.a;
	return [
		...sprite(pet, animation).map((line) => centered(line, width)),
		centered(`\x1b[38;5;${badgeColour}m${pet.rarity}\x1b[0m ${theme.fg("text", pet.name)}`, width),
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
