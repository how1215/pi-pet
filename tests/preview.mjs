// Generate pixel previews without graphics dependencies. Same palette and
// geometry as the terminal renderer; preview images are not TUI screenshots.
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateSync } from "node:zlib";

const piRoot = process.argv[2] ?? resolve(dirname(fileURLToPath(import.meta.resolve("@earendil-works/pi-coding-agent"))), "..");
const requirePi = createRequire(resolve(piRoot, "package.json"));
const { createJiti } = requirePi("jiti");
const jiti = createJiti(import.meta.url, {
	alias: { "@earendil-works/pi-tui": requirePi.resolve("@earendil-works/pi-tui") },
});
const { PETS } = await jiti.import("../pets.ts");
const { ANIMATIONS, animationPixels } = await jiti.import("../view.ts");
const background = [25, 26, 34];
function colour(index) {
	if (index >= 232) return Array(3).fill(8 + (index - 232) * 10);
	const cube = [0, 95, 135, 175, 215, 255];
	const n = index - 16;
	return [cube[Math.floor(n / 36)], cube[Math.floor(n / 6) % 6], cube[n % 6]];
}
function chunk(name, data) {
	const body = Buffer.concat([Buffer.from(name), data]);
	const size = Buffer.alloc(4); size.writeUInt32BE(data.length);
	const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(body));
	return Buffer.concat([size, body, checksum]);
}
function preview(file, panels, columns, scale) {
	const width = columns * 20 * scale;
	const height = Math.ceil(panels.length / columns) * 16 * scale;
	const pixels = Array.from({ length: height / scale }, () => Array(width / scale).fill(background));
	panels.forEach(({ pet, animation, frame }, i) => {
		const x = (i % columns) * 20 + 2;
		const y = Math.floor(i / columns) * 16 + 2;
		animationPixels(pet, animation, frame).forEach((row, dy) => row.forEach((key, dx) => {
			if (key !== ".") pixels[y + dy][x + dx] = colour(pet.palette[key]);
		}));
	});
	const raw = Buffer.alloc(height * (1 + width * 3));
	for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
		const rgb = pixels[Math.floor(y / scale)][Math.floor(x / scale)];
		for (let c = 0; c < 3; c++) raw[y * (1 + width * 3) + 1 + x * 3 + c] = rgb[c];
	}
	const header = Buffer.alloc(13);
	header.writeUInt32BE(width); header.writeUInt32BE(height, 4);
	header[8] = 8; header[9] = 2;
	writeFileSync(new URL(file, import.meta.url), Buffer.concat([
		Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
		chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
	]));
}
preview("../assets/pets.png", PETS.map((pet) => ({ pet, animation: "idle", frame: 0 })), 4, 8);
preview("../assets/animations.png", ANIMATIONS.flatMap((animation) => [0, 1].flatMap((frame) => PETS.map((pet) => ({ pet, animation, frame })))), 8, 4);
console.log("Updated assets/pets.png and assets/animations.png");
