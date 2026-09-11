export const STATE_TYPE = "session-pet:v1";
export type Rarity = "N" | "R" | "SR" | "SSR";
export interface PetState { version: 1; petId: string }

// 16 x 12 pixels, packed into 16 x 6 terminal cells by the renderer.
// . = empty, o = outline, b = body, s = shadow, h = highlight,
// e = eyes, p = cheeks, a = accent. ANSI 256 colours work in Terminal.app.
export const PETS = [
	{
		id: "cache-cat", name: "快取貓", rarity: "N" as Rarity,
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
		id: "stack-fox", name: "堆疊狐", rarity: "R" as Rarity,
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
		id: "byte-dragon", name: "位元龍", rarity: "SR" as Rarity,
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
		id: "kernel-phoenix", name: "核心鳳凰", rarity: "SSR" as Rarity,
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
	"我沒有失眠，我只是 busy waiting。",
	"我沒有拖延，我在 lazy evaluation。",
	"不是忘記你，是 cache miss。",
	"我的社交協定是 UDP：說了，不保證收到。",
	"別叫我起床，我是 sleeping thread。",
	"今天的心情：418 I'm a teapot。",
	"我想放下過去，但它還有 reference。",
	"我們不是冷戰，是 distributed deadlock。",
	"我不是胖，是 space complexity 比較高。",
	"人生沒有 undo，只有 git reflog。",
	"你說永遠？請先定義 termination condition。",
	"我很專情，因為我是 singleton。",
	"我不是發呆，是在等 interrupt。",
	"我的安全感，來自每天的 backup。",
	"你是我的 base case，不然我會無限遞迴。",
	"我的計畫很完美，只是還沒 compile。",
	"我把煩惱丟進 queue，現在它 overflow 了。",
	"我沒有迷路，只是在做 depth-first search。",
	"今天也努力保持 eventual consistency。",
	"不是我難相處，是你的 API 沒看文件。",
	"我沒有偷懶，只是在做 memoization。",
	"愛情是 race condition：你以為輪到你了。",
	"我和 bug 的關係：修好了，但沒完全修好。",
	"先別問人生意義，先問 null check 了沒。",
];

export function nextJoke(previous: number, random: () => number = Math.random): number {
	if (previous < 0) return Math.floor(random() * JOKES.length);
	const index = Math.floor(random() * (JOKES.length - 1));
	return index >= previous ? index + 1 : index;
}
