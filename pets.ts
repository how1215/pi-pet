export const STATE_TYPE = "session-pet:v1";
export type Rarity = "N" | "R" | "SR" | "SSR";
export interface PetState { version: 1; petId: string }

// 16 x 12 pixels, packed into 16 x 6 terminal cells by the renderer.
// . = empty, o = outline, b = body, s = shadow, h = highlight,
// e = eyes, p = cheeks, a = accent. ANSI 256 colours work in Terminal.app.
export const PETS = [
	{
		id: "cache-cat", name: "Cache Cat", rarity: "N" as Rarity,
		palette: { o: 60, b: 223, s: 180, h: 230, e: 235, p: 211, a: 153 },
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

export const JOKES = [
	"I don't have insomnia. I'm just busy waiting.",
	"I'm not procrastinating. This is lazy evaluation.",
	"I didn't forget you. It was a cache miss.",
	"I socialize over UDP. Delivery is not guaranteed.",
	"Do not disturb. I'm a sleeping thread.",
	"Current mood: 418 I'm a teapot.",
	"I'd let go of the past, but it still has references.",
	"We're not giving each other the silent treatment. It's a distributed deadlock.",
	"I'm not bulky. I just have high space complexity.",
	"Life has no undo. Luckily, Git has reflog.",
	"Forever? Please define a termination condition.",
	"I'm one of a kind. The pattern is called Singleton.",
	"I'm not zoning out. I'm waiting for an interrupt.",
	"My love language is a verified backup.",
	"You're my base case. Without you, I'd recurse forever.",
	"My plan is flawless. It just hasn't compiled yet.",
	"I queued my worries. Now the queue is overflowing.",
	"I'm not lost. I'm doing depth-first search.",
	"I'll get my life together. Eventually consistent, right?",
	"I'm not difficult. You just skipped my API docs.",
	"I'm not cutting corners. I'm using memoization.",
	"Love is a race condition. You thought it was your turn.",
	"I fixed the bug. Its relatives have filed a complaint.",
	"Before asking life's big questions, check for null.",
];

export function nextJoke(previous: number, random: () => number = Math.random): number {
	if (previous < 0) return Math.floor(random() * JOKES.length);
	const index = Math.floor(random() * (JOKES.length - 1));
	return index >= previous ? index + 1 : index;
}
