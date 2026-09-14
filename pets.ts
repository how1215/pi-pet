import { ARTWORK } from "./artwork.ts";

export const STATE_TYPE = "session-pet:v2";
export const LEGACY_STATE_TYPE = "session-pet:v1";
export type Rarity = "N" | "R" | "SR" | "SSR";
export type AnimationState = "idle" | "blinking" | "talking" | "sleeping" | "celebrating" | "sad" | "eating" | "playing";
export interface LegacyPetState { version: 1; petId: string }
export interface PetState {
	version: 2;
	petId: string;
	xp: number;
	level: number;
	affinity: number;
	unlockedPetIds: string[];
}

export const XP_PER_LEVEL = 100;
export const MAX_AFFINITY = 100;

// 16 x 12 pixels, packed into 16 x 6 terminal cells by the renderer.
// . = empty, o = outline, b = body, s = shadow, h = highlight,
// e = eyes, q = eye glint, m = mouth, p = cheeks, a = accent, i = muzzle.
// Facial contrast uses near-black eyes against a light face in every palette.
export const PETS = [
	{
		id: "cache-cat", name: "Cache Cat", rarity: "N" as Rarity, unlockLevel: 1,
		palette: { o: 60, b: 223, s: 180, h: 230, e: 232, q: 231, m: 52, p: 211, a: 153, i: 230 },
		lines: [
			"That idea is cached. Let's make it fast.",
			"I found the bug hiding behind a stale key.",
			"A warm cache and a clean build make a fine day.",
			"If it works twice, should we memoize it?",
		],
		...ARTWORK["cache-cat"],
	},
	{
		id: "stack-fox", name: "Stack Fox", rarity: "R" as Rarity, unlockLevel: 2,
		palette: { o: 52, b: 209, s: 166, h: 230, e: 232, q: 231, m: 52, p: 217, a: 220, i: 230 },
		lines: [
			"I followed the stack trace all the way home.",
			"No panic. We can unwind this together.",
			"One more frame and we'll catch that bug.",
			"My tail is recursive, but the compiler approves.",
		],
		...ARTWORK["stack-fox"],
	},
	{
		id: "byte-dragon", name: "Byte Dragon", rarity: "SR" as Rarity, unlockLevel: 3,
		palette: { o: 17, b: 117, s: 68, h: 195, e: 232, q: 231, m: 17, p: 183, a: 141, i: 195 },
		lines: [
			"I breathe bits, not fire. Usually.",
			"Your types are safe under my watch.",
			"Feed me bytes and I'll guard the build.",
			"That bug is about to become byte-sized.",
		],
		...ARTWORK["byte-dragon"],
	},
	{
		id: "kernel-phoenix", name: "Kernel Phoenix", rarity: "SSR" as Rarity, unlockLevel: 5,
		palette: { o: 88, b: 214, s: 202, h: 229, e: 232, q: 231, m: 88, p: 203, a: 220, i: 229 },
		lines: [
			"From every kernel panic, I rise again.",
			"Your process has my highest priority.",
			"Ashes to branches, branches to releases.",
			"Reboot boldly. I saved the state.",
		],
		...ARTWORK["kernel-phoenix"],
	},
	{
		id: "queue-rabbit", name: "Queue Rabbit", rarity: "N" as Rarity, unlockLevel: 1,
		palette: { o: 60, b: 189, s: 146, h: 255, e: 232, q: 231, m: 60, p: 211, a: 213, i: 255 },
		lines: [
			"First in, first hop. That's my queue policy.",
			"One carrot at a time. Backpressure works!",
			"I'll hop over that race condition with you.",
			"My ears are listening for the next event.",
		],
		...ARTWORK["queue-rabbit"],
	},
	{
		id: "regex-raccoon", name: "Regex Raccoon", rarity: "R" as Rarity, unlockLevel: 2,
		palette: { o: 235, b: 245, s: 239, h: 255, e: 232, q: 231, m: 235, p: 217, a: 118, i: 255 },
		lines: [
			"I found a match! No dumpster diving required.",
			"Greedy? Only when matching snacks.",
			"I'll capture the bug, not your keyboard.",
			"Every good pattern deserves a test case.",
		],
		...ARTWORK["regex-raccoon"],
	},
	{
		id: "cloud-otter", name: "Cloud Otter", rarity: "SR" as Rarity, unlockLevel: 3,
		palette: { o: 94, b: 137, s: 95, h: 230, e: 232, q: 231, m: 52, p: 217, a: 159, i: 230 },
		lines: [
			"Floating on a cloud of passing tests.",
			"I keep my favorite shell in object storage.",
			"Let's scale out, then float back home.",
			"Stay buoyant. We have a backup region.",
		],
		...ARTWORK["cloud-otter"],
	},
	{
		id: "quantum-owl", name: "Quantum Owl", rarity: "SSR" as Rarity, unlockLevel: 5,
		palette: { o: 17, b: 99, s: 61, h: 225, e: 232, q: 231, m: 17, p: 183, a: 220, i: 225 },
		lines: [
			"The bug is both fixed and not. Run the tests.",
			"Who observes the observer? Hoot.",
			"My wings are entangled with your next idea.",
			"Let's collapse uncertainty into a clean build.",
		],
		...ARTWORK["quantum-owl"],
	},
];
export type Pet = (typeof PETS)[number];

export function levelForXp(xp: number): number {
	return Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1;
}

export function unlockedAtLevel(level: number): string[] {
	return PETS.filter((pet) => pet.unlockLevel <= level).map((pet) => pet.id);
}

export function drawPet(random: () => number = Math.random): PetState {
	const roll = random();
	const rarity: Rarity = roll < 0.60 ? "N" : roll < 0.85 ? "R" : roll < 0.97 ? "SR" : "SSR";
	const candidates = PETS.filter((pet) => pet.rarity === rarity);
	const petId = candidates[Math.floor(random() * candidates.length)].id;
	return { version: 2, petId, xp: 0, level: 1, affinity: 0, unlockedPetIds: [...new Set([...unlockedAtLevel(1), petId])] };
}

function validPetId(value: unknown): value is string {
	return typeof value === "string" && PETS.some((pet) => pet.id === value);
}

export function migratePet(data: LegacyPetState): PetState {
	return {
		version: 2,
		petId: data.petId,
		xp: 0,
		level: 1,
		affinity: 0,
		unlockedPetIds: [...new Set([...unlockedAtLevel(1), data.petId])],
	};
}

// Read all entries from newest to oldest so progression snapshots survive reloads.
export function restorePet(entries: readonly { type: string; customType?: string; data?: unknown }[]): { state: PetState; migrated: boolean } | undefined {
	for (let index = entries.length - 1; index >= 0; index--) {
		const entry = entries[index];
		if (entry?.type !== "custom") continue;
		if (entry.customType === STATE_TYPE) {
			const data = entry.data as Partial<PetState> | null;
			if (data?.version !== 2 || !validPetId(data.petId) || !Number.isInteger(data.xp) || data.xp! < 0 ||
				!Number.isInteger(data.level) || data.level !== levelForXp(data.xp!) ||
				!Number.isInteger(data.affinity) || data.affinity! < 0 || data.affinity! > MAX_AFFINITY ||
				!Array.isArray(data.unlockedPetIds) || !data.unlockedPetIds.every(validPetId) ||
				!data.unlockedPetIds.includes(data.petId)) continue;
			const unlockedPetIds = [...new Set([...data.unlockedPetIds, ...unlockedAtLevel(data.level!)])];
			return {
				state: { ...data, unlockedPetIds } as PetState,
				migrated: unlockedPetIds.length !== data.unlockedPetIds.length,
			};
		}
		if (entry.customType === LEGACY_STATE_TYPE) {
			const data = entry.data as Partial<LegacyPetState> | null;
			if (data?.version === 1 && validPetId(data.petId)) return { state: migratePet(data as LegacyPetState), migrated: true };
		}
	}
	return undefined;
}

export function gainProgress(state: PetState, xp: number, affinity: number): { state: PetState; unlocked: string[] } {
	const nextXp = state.xp + xp;
	const level = levelForXp(nextXp);
	const unlockedPetIds = [...new Set([...state.unlockedPetIds, ...unlockedAtLevel(level)])];
	return {
		state: { ...state, xp: nextXp, level, affinity: Math.min(MAX_AFFINITY, state.affinity + affinity), unlockedPetIds },
		unlocked: unlockedPetIds.filter((id) => !state.unlockedPetIds.includes(id)),
	};
}

export const JOKES = PETS.flatMap((pet) => pet.lines);

export function nextJoke(previous: number, random: () => number = Math.random, lines: readonly string[] = JOKES): number {
	if (previous < 0) return Math.floor(random() * lines.length);
	const index = Math.floor(random() * (lines.length - 1));
	return index >= previous ? index + 1 : index;
}
