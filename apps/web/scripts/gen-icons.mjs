import sharp from "sharp";
import { promises as fs } from "node:fs";
import path from "node:path";

const PUB = path.resolve("public");

const wordmarkSvg = (size, padding = size * 0.18) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#0e7c66"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#g)"/>
  <g fill="none" stroke="white" stroke-width="${size * 0.05}" stroke-linecap="round" stroke-linejoin="round" transform="translate(${size * 0.5} ${size * 0.5})">
    <!-- bicycle silhouette: two wheels + frame -->
    <circle cx="-${size * 0.18}" cy="${size * 0.08}" r="${size * 0.12}"/>
    <circle cx="${size * 0.18}" cy="${size * 0.08}" r="${size * 0.12}"/>
    <path d="M -${size * 0.18} ${size * 0.08} L 0 -${size * 0.04} L ${size * 0.08} ${size * 0.08} M 0 -${size * 0.04} L ${size * 0.04} -${size * 0.18} L ${size * 0.14} -${size * 0.18}"/>
  </g>
</svg>`;

const maskableSvg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#10b981"/>
  <g fill="none" stroke="white" stroke-width="${size * 0.04}" stroke-linecap="round" stroke-linejoin="round" transform="translate(${size * 0.5} ${size * 0.5})">
    <circle cx="-${size * 0.13}" cy="${size * 0.06}" r="${size * 0.09}"/>
    <circle cx="${size * 0.13}" cy="${size * 0.06}" r="${size * 0.09}"/>
    <path d="M -${size * 0.13} ${size * 0.06} L 0 -${size * 0.03} L ${size * 0.06} ${size * 0.06} M 0 -${size * 0.03} L ${size * 0.03} -${size * 0.13} L ${size * 0.10} -${size * 0.13}"/>
  </g>
</svg>`;

await fs.mkdir(PUB, { recursive: true });
const targets = [
  { name: "icon-192.png", size: 192, svg: wordmarkSvg(192) },
  { name: "icon-512.png", size: 512, svg: wordmarkSvg(512) },
  { name: "apple-touch-icon.png", size: 180, svg: wordmarkSvg(180) },
  { name: "icon-maskable.png", size: 512, svg: maskableSvg(512) },
];

for (const t of targets) {
  await sharp(Buffer.from(t.svg)).png().toFile(path.join(PUB, t.name));
  console.log("wrote", t.name);
}

// favicon (32px round)
await sharp(Buffer.from(wordmarkSvg(64))).resize(32, 32).png().toFile(path.join(PUB, "favicon-32.png"));
console.log("done");
