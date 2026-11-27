// THE WORLD IN ONE PAGE — Friday 27 November 2026.
// A one-page broadsheet drawn entirely in code: a 5x7 letterpress font,
// flat colour panels and a from-scratch PNG encoder. No network, no clock,
// no randomness: every run prints byte-identical copies of the page.
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;

// ---------- PNG writer ----------
const crcTable: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable.push(c >>> 0);
}
function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
function encodePng(rgb: Uint8Array): Uint8Array {
  const raw = new Uint8Array((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 3 + 1)] = 0;
    raw.set(rgb.subarray(y * W * 3, (y + 1) * W * 3), y * (W * 3 + 1) + 1);
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, W);
  dv.setUint32(4, H);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", new Uint8Array(0))];
  const png = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let off = 0;
  for (const p of parts) {
    png.set(p, off);
    off += p.length;
  }
  return png;
}

// ---------- canvas ----------
type Rgb = [number, number, number];
const PAPER: Rgb = [245, 239, 227];
const INK: Rgb = [20, 22, 28];
const RED: Rgb = [163, 22, 35];
const BLUE: Rgb = [29, 78, 137];
const GRAY: Rgb = [108, 110, 116];
const FAINT: Rgb = [212, 205, 188];
const SKY: Rgb = [196, 214, 232];
const canvas = new Uint8Array(W * H * 3);
function paint(x: number, y: number, c: Rgb): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  canvas[i] = c[0];
  canvas[i + 1] = c[1];
  canvas[i + 2] = c[2];
}
function fillRect(x: number, y: number, w: number, h: number, c: Rgb): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) paint(xx, yy, c);
}
function hRule(x: number, y: number, w: number, t: number, c: Rgb): void {
  fillRect(x, y, w, t, c);
}
function vRule(x: number, y: number, h: number, t: number, c: Rgb): void {
  fillRect(x, y, t, h, c);
}
function frame(x: number, y: number, w: number, h: number, t: number, c: Rgb): void {
  hRule(x, y, w, t, c);
  hRule(x, y + h - t, w, t, c);
  vRule(x, y, h, t, c);
  vRule(x + w - t, y, h, t, c);
}
function disc(cx: number, cy: number, r: number, c: Rgb): void {
  for (let y = cy - r; y <= cy + r; y++)
    for (let x = cx - r; x <= cx + r; x++)
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) paint(x, y, c);
}

// ---------- 5x7 letterpress ----------
const GLYPHS: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  "3": [0x1e, 0x01, 0x01, 0x0e, 0x01, 0x01, 0x1e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ",": [0, 0, 0, 0, 0x0c, 0x04, 0x08],
  ":": [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  ";": [0, 0x0c, 0x0c, 0, 0x0c, 0x04, 0x08],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  "-": [0, 0, 0, 0x0e, 0, 0, 0],
  "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  "?": [0x0e, 0x11, 0x01, 0x06, 0x04, 0, 0x04],
  "%": [0x19, 0x1a, 0x02, 0x04, 0x08, 0x0b, 0x13],
  $: [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04],
  "/": [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
  "+": [0, 0x04, 0x04, 0x0e, 0x04, 0x04, 0],
  "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  "=": [0, 0, 0x1f, 0, 0x1f, 0, 0],
};
const ADV = 6;
function textWidth(text: string, scale: number): number {
  return text.length === 0 ? 0 : text.length * ADV * scale - scale;
}
function drawText(x: number, y: number, text: string, scale: number, c: Rgb): void {
  let cx = x;
  for (const ch of text) {
    const glyph = GLYPHS[ch] ?? GLYPHS[" "];
    for (let row = 0; row < 7; row++)
      for (let col = 0; col < 5; col++)
        if (glyph[row] & (0x10 >> col)) fillRect(cx + col * scale, y + row * scale, scale, scale, c);
    cx += ADV * scale;
  }
}
function drawCentered(cx: number, y: number, text: string, scale: number, c: Rgb): void {
  drawText(Math.round(cx - textWidth(text, scale) / 2), y, text, scale, c);
}
function wrap(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const w of text.split(" ")) {
    const next = line === "" ? w : line + " " + w;
    if (next.length > maxChars && line !== "") {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line !== "") lines.push(line);
  return lines;
}
function drawBlock(x: number, y: number, text: string, maxChars: number, scale: number, leading: number, c: Rgb): number {
  const lines = wrap(text, maxChars);
  for (let i = 0; i < lines.length; i++) drawText(x, y + i * leading, lines[i], scale, c);
  return y + lines.length * leading;
}

// ---------- compose the page ----------
fillRect(0, 0, W, H, PAPER);
const M = 46;
const RIGHT = W - M;

// masthead
hRule(M, 36, W - 2 * M, 3, INK);
drawCentered(W / 2, 52, "THE WORLD IN ONE PAGE", 6, INK);
drawCentered(W / 2, 106, "FRIDAY, 27 NOVEMBER 2026 - ONE DAY, ONE PICTURE", 2, GRAY);
hRule(M, 134, W - 2 * M, 6, INK);
hRule(M, 144, W - 2 * M, 2, INK);

// lead headline
drawCentered(W / 2, 164, "STORM WRECKS THANKSGIVING", 6, INK);
drawCentered(W / 2, 216, "400 FLIGHTS CANCELLED AS THE EAST COAST GOES DARK", 2, RED);
hRule(M, 244, W - 2 * M, 2, INK);

// storm panel, left: a cloud, rain and a bolt over a dark sky
const px = M;
const py = 264;
const pw = 330;
const ph = 236;
frame(px, py, pw, ph, 2, INK);
fillRect(px + 2, py + 2, pw - 4, ph - 4, SKY);
disc(px + 92, py + 78, 52, INK);
disc(px + 150, py + 62, 62, INK);
disc(px + 214, py + 82, 46, INK);
fillRect(px + 52, py + 78, 196, 52, INK);
for (let i = 0; i < 9; i++) {
  const rx = px + 44 + i * 28;
  const ry = py + 142 + (i % 3) * 10;
  for (let t = 0; t < 16; t += 4) fillRect(rx - t / 2, ry + t, 3, 5, BLUE);
}
// lightning bolt: a zigzag stamped as a thick polyline
const boltPath: Array<[number, number]> = [
  [206, 128], [190, 158], [204, 158], [184, 196], [200, 196], [188, 228],
];
for (let s = 0; s < boltPath.length - 1; s++) {
  const [x0, y0] = boltPath[s];
  const [x1, y1] = boltPath[s + 1];
  const steps = 24;
  for (let t = 0; t <= steps; t++) {
    const bx = Math.round(x0 + ((x1 - x0) * t) / steps);
    const by = Math.round(y0 + ((y1 - y0) * t) / steps);
    fillRect(px + bx - 5, py + by - 5, 11, 11, [232, 196, 58]);
  }
}
drawText(px + 14, py + ph - 26, "THE STORM, AT NOON", 1, GRAY);

// lead story, right of the panel
const lx = px + pw + 26;
const lw = RIGHT - lx;
drawBlock(lx, py + 2, "THANKSGIVING IN THE DARK", 22, 3, 26, INK);
hRule(lx, py + 58, lw, 2, RED);
drawBlock(
  lx,
  py + 72,
  "A POWERFUL STORM BATTERED THE EASTERN UNITED STATES ON THANKSGIVING " +
    "DAY, CANCELLING NEARLY 400 FLIGHTS AND DELAYING MORE THAN 2,000. " +
    "OVER 900,000 HOMES AND BUSINESSES LOST POWER AS HIGH WINDS AND " +
    "FLOODING CLOSED ROADS AND AIRPORTS FROM THE CAROLINAS TO NEW ENGLAND. " +
    "AIRLINES WARNED OF FURTHER DISRUPTION INTO THE WEEKEND.",
  52,
  1,
  11,
  INK
);
hRule(M, 524, W - 2 * M, 2, INK);

// two columns: the Gulf and Ukraine
const colY = 546;
const colW = 452;
const stories: Array<[string, string, string]> = [
  [
    "GULF ON EDGE",
    "DRONE KILLS TWO ITALIANS IN KUWAIT",
    "TWO ITALIANS WERE KILLED IN A DRONE STRIKE IN KUWAIT, AS IRAN STEPPED " +
      "UP ATTACKS ON KUWAIT AND BAHRAIN AND PRESSED ITS FIGHT WITH THE " +
      "UNITED STATES OVER THE STRAIT OF HORMUZ. TEHRAN DENIED RESPONSIBILITY. " +
      "BRENT CRUDE CLIMBED TOWARD 97 DOLLARS A BARREL ON THE NEWS.",
  ],
  [
    "UKRAINE BRACES",
    "ZELENSKY WARNS OF NEW MASS STRIKE",
    "PRESIDENT ZELENSKY WARNED OF A NEW RUSSIAN MASS STRIKE IN THE COMING " +
      "DAYS, AS MOSCOW KEPT UP NEAR-CONTINUOUS ATTACKS ON KYIV AND OTHER " +
      "CITIES. PRESIDENT TRUMP SAID HE HAD URGED PRESIDENT PUTIN TO PULL " +
      "BACK MILITARY AGGRESSION WHEN THEY MET IN CHINA LAST WEEK.",
  ],
];
for (let i = 0; i < stories.length; i++) {
  const x = M + i * (colW + 28);
  if (i > 0) vRule(x - 15, colY, 210, 1, FAINT);
  drawText(x, colY, stories[i][0], 2, RED);
  const afterHead = drawBlock(x, colY + 24, stories[i][1], 26, 2, 17, INK);
  hRule(x, afterHead + 6, colW, 1, GRAY);
  drawBlock(x, afterHead + 16, stories[i][2], 62, 1, 11, INK);
}
hRule(M, 778, W - 2 * M, 2, INK);

// by the numbers
const numY = 798;
const numW = 218;
const numGap = (W - 2 * M - numW * 4) / 3;
const numbers: Array<[string, string]> = [
  ["400", "FLIGHTS CANCELLED"],
  ["900,000", "HOMES WITHOUT POWER"],
  ["$97", "BRENT CRUDE A BARREL"],
  ["3,000 M", "ASH OVER MAYON"],
];
for (let i = 0; i < numbers.length; i++) {
  const x = M + i * (numW + numGap);
  frame(x, numY, numW, 64, 1, INK);
  drawCentered(x + numW / 2, numY + 10, numbers[i][0], 3, RED);
  drawCentered(x + numW / 2, numY + 40, numbers[i][1], 1, GRAY);
}

// in brief
const briefY = 884;
drawText(M, briefY, "IN BRIEF", 2, RED);
drawBlock(
  M,
  briefY + 26,
  "MAYON VOLCANO ERUPTS IN THE PHILIPPINES, THROWING ASH 3,000 METRES HIGH - " +
    "UK NET MIGRATION FALLS TO ITS LOWEST SINCE 1997 - US CLEARS SPACEX TO LAUNCH " +
    "UP TO A MILLION ORBITAL DATA-CENTRE SATELLITES - INDIA FACE NEW ZEALAND ON DAY " +
    "ONE OF THE CHRISTCHURCH TEST - GUKESH DRAWS GAME THREE OF THE WORLD CHESS " +
    "CHAMPIONSHIP - FUEL TANKER FIRE KILLS 31 ON A CROWDED CAIRO HIGHWAY.",
  118,
  1,
  11,
  INK
);

// colophon
drawCentered(W / 2, 990, "THE WORLD IN ONE PAGE - SET IN SOFTWARE TYPE - FRIDAY 27 NOVEMBER 2026", 1, GRAY);

// ---------- print it ----------
mkdirSync(process.env.MAKEFUN_OUTPUT_DIR ?? "/output", { recursive: true });
const png = encodePng(canvas);
writeFileSync((process.env.MAKEFUN_OUTPUT_DIR ?? "/output") + "/entry.png", png);
console.log("entry.png:", png.length, "bytes");
