export const STATE_TYPE = "session-pet:v1";
export type Rarity = "N" | "R" | "SR" | "SSR";
export type AnimationState = "idle" | "blinking" | "talking";
export interface PetState { version: 1; petId: string }

// 16 x 12 pixels, packed into 16 x 6 terminal cells by the renderer.
// . = empty, o = outline, b = body, s = shadow, h = highlight,
// e = eyes, p = cheeks, a = accent. ANSI 256 colours work in Terminal.app.
export const PETS = [
	{
		id: "cache-cat", name: "Cache Cat", rarity: "N" as Rarity,
		palette: { o: 60, b: 223, s: 180, h: 230, e: 235, p: 211, a: 153 },
		lines: [
			"That idea is cached. Let's make it fast.",
			"I found the bug hiding behind a stale key.",
			"A warm cache and a clean build make a fine day.",
			"If it works twice, should we memoize it?",
		],
		pixels: [
			"...oo......oo...",
			"...obo....obo...",
			"...obboooobbo...",
			"..obbbbbbbbbbo..",
			"..obhebbbhebo...",
			"..obpebbbepbo...",
			"...obbhhhbbo....",
			"....obbbbbo..oo.",
			"...obbhhbbboobo.",
			"...obbhhbbbsbo..",
			"....ossoosso....",
			".....oo..oo.....",
		],
	},
	{
		id: "stack-fox", name: "Stack Fox", rarity: "R" as Rarity,
		palette: { o: 52, b: 209, s: 166, h: 230, e: 235, p: 217, a: 220 },
		lines: [
			"I followed the stack trace all the way home.",
			"No panic. We can unwind this together.",
			"One more frame and we'll catch that bug.",
			"My tail is recursive, but the compiler approves.",
		],
		pixels: [
			"..oo........oo..",
			"..obo......obo..",
			"..obbooooobbbo..",
			"..obbbbbbbbbbo..",
			"...ohebbbhebo...",
			"...ohhpephhho...",
			"....ohhehhho..o.",
			".....ohhho...oho",
			"....obhhbbo.ohho",
			"....obhhbbosbbo.",
			"....ossoossbbo..",
			".....oo..oooo...",
		],
	},
	{
		id: "byte-dragon", name: "Byte Dragon", rarity: "SR" as Rarity,
		palette: { o: 17, b: 117, s: 68, h: 195, e: 235, p: 183, a: 141 },
		lines: [
			"I breathe bits, not fire. Usually.",
			"Your types are safe under my watch.",
			"Feed me bytes and I'll guard the build.",
			"That bug is about to become byte-sized.",
		],
		pixels: [
			".....a....a.....",
			"....oaobboao....",
			"....obbbbbbo....",
			"....ohebeho.....",
			".....obhhbo.....",
			".oo..obbbbo..oo.",
			".obaoobbbboobao.",
			"..obaobhhboabo..",
			"...ooobhhbooo.a.",
			".....obhhbbo.obo",
			".....osbbssoobo.",
			"......oo.ooooo..",
		],
	},
	{
		id: "kernel-phoenix", name: "Kernel Phoenix", rarity: "SSR" as Rarity,
		palette: { o: 88, b: 214, s: 202, h: 229, e: 235, p: 203, a: 220 },
		lines: [
			"From every kernel panic, I rise again.",
			"Your process has my highest priority.",
			"Ashes to branches, branches to releases.",
			"Reboot boldly. I saved the state.",
		],
		pixels: [
			"......a.a.......",
			".....oaaao......",
			".....obbbbo.....",
			".....ohehbo.....",
			"......obhaao....",
			".aao..obbo..oaa.",
			"..obooobbooobo..",
			"...obbhhhbbbo...",
			"....oobbbboo....",
			".....osbsbo.....",
			"....oasbsbao....",
			"...aa..s..aaa...",
		],
	},
];
export type Pet = (typeof PETS)[number];

export function drawPet(random: () => number = Math.random): PetState {
	const roll = random();
	const index = roll < 0.60 ? 0 : roll < 0.85 ? 1 : roll < 0.97 ? 2 : 3;
	return { version: 1, petId: PETS[index].id };
}

// Read ALL entries: navigating /tree must not reroll the session companion.
export function restorePet(entries: readonly { type: string; customType?: string; data?: unknown }[]): PetState | undefined {
	for (const entry of entries) {
		if (entry.type !== "custom" || entry.customType !== STATE_TYPE) continue;
		const data = entry.data as Partial<PetState> | null;
		if (data?.version === 1 && PETS.some((pet) => pet.id === data.petId)) {
			return { version: 1, petId: data.petId! };
		}
	}
	return undefined;
}

export const JOKES = PETS.flatMap((pet) => pet.lines);

export function nextJoke(previous: number, random: () => number = Math.random, lines: readonly string[] = JOKES): number {
	if (previous < 0) return Math.floor(random() * lines.length);
	const index = Math.floor(random() * (lines.length - 1));
	return index >= previous ? index + 1 : index;
}
