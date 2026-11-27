// One page, one day — Friday 27 November 2026.
// A broadsheet drawn entirely in code: a hand-built 5x7 dot font drawn
// from string pictures, flat colour blocks and a small PNG writer written
// from the format spec. No network, no clock, no randomness: the same
// bytes come out of every run.
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const PAGE_W = 1024;
const PAGE_H = 1024;

// ---------- tiny PNG writer ----------
function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
}
const CRC_TABLE = buildCrcTable();

function crcOf(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u32be(value: number): Uint8Array {
  const out = new Uint8Array(4);
  const view = new DataView(out.buffer);
  view.setUint32(0, value);
  return out;
}

function pngChunk(kind: string, payload: Uint8Array): Uint8Array {
  const head = new Uint8Array(8);
  head.set(u32be(payload.length), 0);
  for (let i = 0; i < 4; i++) head[4 + i] = kind.charCodeAt(i);
  const tail = new Uint8Array(4);
  const joined = new Uint8Array(head.length + payload.length);
  joined.set(head, 0);
  joined.set(payload, head.length);
  const sum = new Uint8Array(head.length + payload.length);
  sum.set(head.subarray(4), 0);
  sum.set(payload, 4);
  tail.set(u32be(crcOf(sum)), 0);
  const out = new Uint8Array(joined.length + 4);
  out.set(joined, 0);
  out.set(tail, joined.length);
  return out;
}

function encodePng(pixels: Uint8Array, width: number, height: number): Uint8Array {
  const stride = width * 3 + 1;
  const raw = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    raw.set(pixels.subarray(y * width * 3, (y + 1) * width * 3), y * stride + 1);
  }
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header[8] = 8; // bit depth
  header[9] = 2; // truecolour
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const pieces = [
    signature,
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", new Uint8Array(0)),
  ];
  const total = pieces.reduce((sum, piece) => sum + piece.length, 0);
  const png = new Uint8Array(total);
  let offset = 0;
  for (const piece of pieces) {
    png.set(piece, offset);
    offset += piece.length;
  }
  return png;
}

// ---------- the sheet ----------
type Colour = [number, number, number];
const PAPER: Colour = [246, 240, 228];
const INK: Colour = [18, 20, 26];
const CRIMSON: Colour = [168, 26, 38];
const NAVY: Colour = [27, 74, 132];
const SLATE: Colour = [110, 112, 118];
const SAND: Colour = [214, 206, 190];
const PALE: Colour = [198, 216, 233];
const GOLD: Colour = [235, 198, 60];

const sheet = new Uint8Array(PAGE_W * PAGE_H * 3);

function dot(x: number, y: number, colour: Colour): void {
  if (x < 0 || y < 0 || x >= PAGE_W || y >= PAGE_H) return;
  const i = (y * PAGE_W + x) * 3;
  sheet[i] = colour[0];
  sheet[i + 1] = colour[1];
  sheet[i + 2] = colour[2];
}

function box(x: number, y: number, w: number, h: number, colour: Colour): void {
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) dot(xx, yy, colour);
}

function hline(x: number, y: number, w: number, thick: number, colour: Colour): void {
  box(x, y, w, thick, colour);
}

function vline(x: number, y: number, h: number, thick: number, colour: Colour): void {
  box(x, y, thick, h, colour);
}

function outline(x: number, y: number, w: number, h: number, thick: number, colour: Colour): void {
  hline(x, y, w, thick, colour);
  hline(x, y + h - thick, w, thick, colour);
  vline(x, y, h, thick, colour);
  vline(x + w - thick, y, h, thick, colour);
}

function circle(cx: number, cy: number, r: number, colour: Colour): void {
  for (let y = cy - r; y <= cy + r; y++)
    for (let x = cx - r; x <= cx + r; x++)
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) dot(x, y, colour);
}

// ---------- 5x7 dot font, drawn from string pictures ----------
const FONT: Record<string, string[]> = {
  A: [" ### ", "#   #", "#   #", "#####", "#   #", "#   #", "#   #"],
  B: ["#### ", "#   #", "#   #", "#### ", "#   #", "#   #", "#### "],
  C: [" ####", "#    ", "#    ", "#    ", "#    ", "#    ", " ####"],
  D: ["#### ", "#   #", "#   #", "#   #", "#   #", "#   #", "#### "],
  E: ["#####", "#    ", "#    ", "#### ", "#    ", "#    ", "#####"],
  F: ["#####", "#    ", "#    ", "#### ", "#    ", "#    ", "#    "],
  G: [" ####", "#    ", "#    ", "#  ##", "#   #", "#   #", " ### "],
  H: ["#   #", "#   #", "#   #", "#####", "#   #", "#   #", "#   #"],
  I: [" ### ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", " ### "],
  J: ["  ###", "   # ", "   # ", "   # ", "   # ", "#  # ", " # # "],
  K: ["#   #", "#  # ", "# #  ", "##   ", "# #  ", "#  # ", "#   #"],
  L: ["#    ", "#    ", "#    ", "#    ", "#    ", "#    ", "#####"],
  M: ["#   #", "## ##", "# # #", "# # #", "#   #", "#   #", "#   #"],
  N: ["#   #", "##  #", "# # #", "#  ##", "#   #", "#   #", "#   #"],
  O: [" ### ", "#   #", "#   #", "#   #", "#   #", "#   #", " ### "],
  P: ["#### ", "#   #", "#   #", "#### ", "#    ", "#    ", "#    "],
  Q: [" ### ", "#   #", "#   #", "#   #", "# # #", "#  # ", " ## #"],
  R: ["#### ", "#   #", "#   #", "#### ", "# #  ", "#  # ", "#   #"],
  S: [" ####", "#    ", "#    ", " ### ", "    #", "    #", "#### "],
  T: ["#####", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  "],
  U: ["#   #", "#   #", "#   #", "#   #", "#   #", "#   #", " ### "],
  V: ["#   #", "#   #", "#   #", "#   #", "#   #", " # # ", "  #  "],
  W: ["#   #", "#   #", "#   #", "# # #", "# # #", "## ##", "#   #"],
  X: ["#   #", "#   #", " # # ", "  #  ", " # # ", "#   #", "#   #"],
  Y: ["#   #", "#   #", " # # ", "  #  ", "  #  ", "  #  ", "  #  "],
  Z: ["#####", "    #", "   # ", "  #  ", " #   ", "#    ", "#####"],
  "0": [" ### ", "#  ##", "# # #", "##  #", "#   #", "#   #", " ### "],
  "1": ["  #  ", " ##  ", "  #  ", "  #  ", "  #  ", "  #  ", " ### "],
  "2": [" ### ", "#   #", "    #", "  ## ", " #   ", "#    ", "#####"],
  "3": ["#### ", "    #", "    #", " ### ", "    #", "    #", "#### "],
  "4": ["   # ", "  ## ", " # # ", "#  # ", "#####", "   # ", "   # "],
  "5": ["#####", "#    ", "#### ", "    #", "    #", "#   #", " ### "],
  "6": ["  ## ", " #   ", "#    ", "#### ", "#   #", "#   #", " ### "],
  "7": ["#####", "    #", "   # ", "  #  ", " #   ", " #   ", " #   "],
  "8": [" ### ", "#   #", "#   #", " ### ", "#   #", "#   #", " ### "],
  "9": [" ### ", "#   #", "#   #", " ####", "    #", "   # ", " ##  "],
  " ": ["     ", "     ", "     ", "     ", "     ", "     ", "     "],
  ".": ["     ", "     ", "     ", "     ", "     ", " ##  ", " ##  "],
  ",": ["     ", "     ", "     ", "     ", " ##  ", "  #  ", " #   "],
  ":": ["     ", " ##  ", " ##  ", "     ", " ##  ", " ##  ", "     "],
  ";": ["     ", " ##  ", " ##  ", "     ", " ##  ", "  #  ", " #   "],
  "'": ["  #  ", "  #  ", " #   ", "     ", "     ", "     ", "     "],
  "-": ["     ", "     ", "     ", " ### ", "     ", "     ", "     "],
  "!": ["  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "     ", "  #  "],
  "?": [" ### ", "#   #", "    #", "  ## ", "  #  ", "     ", "  #  "],
  "%": ["##  #", "## # ", "   # ", "  #  ", " #   ", "# ## ", "#  ##"],
  $: ["  #  ", " ####", "# #  ", " ### ", "  # #", "#### ", "  #  "],
  "/": ["    #", "   # ", "   # ", "  #  ", " #   ", " #   ", "#    "],
  "+": ["     ", "  #  ", "  #  ", " ### ", "  #  ", "  #  ", "     "],
  "(": ["   # ", "  #  ", " #   ", " #   ", " #   ", "  #  ", "   # "],
  ")": [" #   ", "  #  ", "   # ", "   # ", "   # ", "  #  ", " #   "],
  "=": ["     ", "     ", "#####", "     ", "#####", "     ", "     "],
};
const CELL = 6;

function measure(text: string, size: number): number {
  return text.length === 0 ? 0 : text.length * CELL * size - size;
}

function print(x: number, y: number, text: string, size: number, colour: Colour): void {
  let cursor = x;
  for (const ch of text) {
    const picture = FONT[ch] ?? FONT[" "];
    for (let row = 0; row < 7; row++)
      for (let col = 0; col < 5; col++)
        if (picture[row][col] === "#") box(cursor + col * size, y + row * size, size, size, colour);
    cursor += CELL * size;
  }
}

function printCentred(cx: number, y: number, text: string, size: number, colour: Colour): void {
  print(Math.round(cx - measure(text, size) / 2), y, text, size, colour);
}

function flow(text: string, width: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line === "" ? word : line + " " + word;
    if (next.length > width && line !== "") {
      out.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line !== "") out.push(line);
  return out;
}

function printPara(x: number, y: number, text: string, width: number, size: number, leading: number, colour: Colour): number {
  const lines = flow(text, width);
  for (let i = 0; i < lines.length; i++) print(x, y + i * leading, lines[i], size, colour);
  return y + lines.length * leading;
}

// ---------- the page ----------
box(0, 0, PAGE_W, PAGE_H, PAPER);
const MARGIN = 48;
const RIGHT = PAGE_W - MARGIN;
const CONTENT = RIGHT - MARGIN;

// masthead
hline(MARGIN, 34, CONTENT, 3, INK);
printCentred(PAGE_W / 2, 48, "THE WORLD IN ONE PAGE", 6, INK);
printCentred(PAGE_W / 2, 100, "FRIDAY 27 NOVEMBER 2026 - ONE DAY, ONE PICTURE", 2, SLATE);
hline(MARGIN, 126, CONTENT, 5, INK);
hline(MARGIN, 134, CONTENT, 2, INK);

// lead band
printCentred(PAGE_W / 2, 152, "THANKSGIVING, IN THE DARK", 2, CRIMSON);
printCentred(PAGE_W / 2, 178, "A STORM STEALS THANKSGIVING", 5, INK);
printCentred(PAGE_W / 2, 224, "NEARLY 400 FLIGHTS GROUNDED - 900,000 HOMES WITHOUT POWER", 2, SLATE);
hline(MARGIN, 248, CONTENT, 2, INK);

// storm picture, left
const picX = MARGIN;
const picY = 266;
const picW = 320;
const picH = 230;
outline(picX, picY, picW, picH, 2, INK);
box(picX + 2, picY + 2, picW - 4, picH - 4, PALE);
circle(picX + 88, picY + 74, 50, INK);
circle(picX + 148, picY + 58, 60, INK);
circle(picX + 208, picY + 78, 44, INK);
box(picX + 50, picY + 74, 190, 50, INK);
for (let i = 0; i < 9; i++) {
  const rx = picX + 46 + i * 27;
  const ry = picY + 138 + (i % 3) * 9;
  for (let t = 0; t < 15; t += 4) box(rx - t / 2, ry + t, 3, 5, NAVY);
}
const bolt: Array<[number, number]> = [
  [204, 126], [188, 156], [202, 156], [182, 194], [198, 194], [186, 226],
];
for (let s = 0; s < bolt.length - 1; s++) {
  const [x0, y0] = bolt[s];
  const [x1, y1] = bolt[s + 1];
  const steps = 24;
  for (let t = 0; t <= steps; t++) {
    const bx = Math.round(x0 + ((x1 - x0) * t) / steps);
    const by = Math.round(y0 + ((y1 - y0) * t) / steps);
    box(picX + bx - 5, picY + by - 5, 11, 11, GOLD);
  }
}
print(picX + 14, picY + picH - 26, "THE STORM AT NOON", 1, SLATE);

// a rooftop under the rain, so the storm has somewhere to land
const houseX = picX + 196;
const houseY = picY + picH - 62;
for (let r = 0; r < 18; r += 6) box(houseX - r, houseY + 12 - r, 84 + r * 2, 6, INK);
box(houseX, houseY + 18, 84, 34, INK);
box(houseX + 34, houseY + 30, 16, 22, PAPER);

// lead story, right of the picture
const storyX = picX + picW + 26;
const storyW = RIGHT - storyX;
print(storyX, picY + 2, "THANKSGIVING IN THE DARK", 3, INK);
hline(storyX, picY + 50, storyW, 2, CRIMSON);
printPara(
  storyX,
  picY + 64,
  "THE STORM THAT SWEPT THE EASTERN SEABOARD ON THANKSGIVING DAY KNOCKED OUT POWER TO MORE THAN 900,000 HOMES AND BUSINESSES, GROUNDED CLOSE TO 400 FLIGHTS AND DELAYED OVER 2,000 MORE. ROADS AND AIRPORTS FROM THE CAROLINAS TO NEW ENGLAND SHUT AS WIND AND FLOODWATER TOOK HOLD, AND CARRIERS WARNED THE MESS WOULD RUN INTO THE WEEKEND.",
  60,
  1,
  12,
  INK
);
hline(MARGIN, 522, CONTENT, 2, INK);

// three columns: the Gulf, Ukraine, Mayon
const colY = 540;
const colW = 294;
const colGap = 24;
const columns: Array<[string, string, string]> = [
  [
    "GULF ON EDGE",
    "DRONE KILLS TWO ITALIANS IN KUWAIT",
    "TWO ITALIANS DIED WHEN A DRONE HIT KUWAIT, AS TEHRAN PRESSED ITS CAMPAIGN AGAINST KUWAIT AND BAHRAIN AND ITS STANDOFF WITH WASHINGTON OVER THE STRAIT OF HORMUZ. IRAN DENIED ANY PART IN THE ATTACK. BRENT CRUDE PUSHED TOWARD 97 DOLLARS A BARREL.",
  ],
  [
    "UKRAINE BRACES",
    "ZELENSKY WARNS OF A NEW MASS STRIKE",
    "VOLODYMYR ZELENSKY TOLD UKRAINIANS TO EXPECT ANOTHER HEAVY RUSSIAN BARRAGE IN THE DAYS AHEAD, WITH KYIV AND OTHER CITIES ALREADY UNDER NEAR-CONSTANT FIRE. DONALD TRUMP SAID HE HAD PRESSED VLADIMIR PUTIN TO EASE OFF WHEN THE TWO MET IN CHINA.",
  ],
  [
    "FIRE MOUNTAIN",
    "MAYON ERUPTS IN THE PHILIPPINES",
    "MOUNT MAYON ERUPTED IN THE PHILIPPINES, THROWING A COLUMN OF ASH 3,000 METRES INTO THE SKY AND DRIVING VILLAGERS FROM ITS SLOPES. IT WAS THE VOLCANO'S LATEST SHOW OF STRENGTH IN A RESTLESS YEAR.",
  ],
];
for (let i = 0; i < columns.length; i++) {
  const x = MARGIN + i * (colW + colGap);
  if (i > 0) vline(x - 13, colY, 210, 1, SAND);
  print(x, colY, columns[i][0], 2, CRIMSON);
  const afterSub = printPara(x, colY + 24, columns[i][1], 26, 2, 17, INK);
  hline(x, afterSub + 6, colW, 1, SLATE);
  printPara(x, afterSub + 16, columns[i][2], 34, 1, 11, INK);
}
hline(MARGIN, 790, CONTENT, 2, INK);

// by the numbers
const numY = 808;
const numW = 218;
const numGap = (CONTENT - numW * 4) / 3;
const figures: Array<[string, string]> = [
  ["400", "FLIGHTS CANCELLED"],
  ["900,000", "HOMES WITHOUT POWER"],
  ["$97", "BRENT CRUDE A BARREL"],
  ["3,000 M", "ASH OVER MAYON"],
];
for (let i = 0; i < figures.length; i++) {
  const x = MARGIN + i * (numW + numGap);
  outline(x, numY, numW, 64, 1, INK);
  printCentred(x + numW / 2, numY + 10, figures[i][0], 3, CRIMSON);
  printCentred(x + numW / 2, numY + 40, figures[i][1], 1, SLATE);
}

// in brief
const briefY = 892;
print(MARGIN, briefY, "IN BRIEF", 2, CRIMSON);
printPara(
  MARGIN,
  briefY + 26,
  "UK NET MIGRATION FALLS TO ITS LOWEST SINCE 1997 - WASHINGTON CLEARS SPACEX TO FLY UP TO A MILLION ORBITAL DATA-CENTRE SATELLITES - INDIA MEET NEW ZEALAND ON DAY ONE AT CHRISTCHURCH - GUKESH DRAWS GAME THREE OF THE WORLD CHESS CHAMPIONSHIP - 31 KILLED AS A FUEL TANKER BURNS ON A CROWDED CAIRO HIGHWAY.",
  118,
  1,
  11,
  INK
);

// colophon
printCentred(PAGE_W / 2, 992, "SET IN SOFTWARE TYPE - FRIDAY 27 NOVEMBER 2026", 1, SLATE);

// ---------- print it ----------
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
mkdirSync(outDir, { recursive: true });
const png = encodePng(sheet, PAGE_W, PAGE_H);
writeFileSync(outDir + "/entry.png", png);
console.log("entry.png:", png.length, "bytes");
