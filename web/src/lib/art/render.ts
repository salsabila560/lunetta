/**
 * Lunetta artwork renderer. Turns a token's traits into a standalone SVG.
 * Same hand-inked style as the site: one ink line, off-register risograph fills.
 * Pure TypeScript (no React) so it runs in API routes and build scripts alike.
 */

export type Traits = {
  Background: string;
  Isle: string;
  Fur: string;
  Wings: string;
  Scarf: string;
  Accessory: string;
  Eyes: string;
  Mark: string;
};

const INK = "#12142B";
const PAPER = "#F3ECDC";
const LANTERN = "#F2C94C";
const MOSS = "#5DCAA5";
const PETAL = "#F4A0BC";
const EMBER = "#E8704A";
const TIDE = "#3E4A9A";
const PLUM = "#7A4E8C";

const BACKGROUNDS: Record<string, { sky: string; dark: boolean }> = {
  Midnight: { sky: "#12142B", dark: true },
  Dusk: { sky: "#2E3274", dark: true },
  Tide: { sky: "#3E4A9A", dark: true },
  Plum: { sky: "#4A2C5E", dark: true },
  Parchment: { sky: "#E7DCC2", dark: false },
  Dawn: { sky: "#F6C9A8", dark: false },
};

const FUR: Record<string, string> = {
  Parchment: "#E7DCC2",
  Snow: "#F7F4EC",
  Ash: "#B9B4A8",
  Lavender: "#B9B4D8",
  Ember: "#F0A27E",
  Moss: "#9FD8C0",
  Petal: "#F4A0BC",
  Midnight: "#4B4F80",
  Moongold: "#F2C94C",
};

const SCARF: Record<string, string> = {
  Ember: EMBER,
  Tide: TIDE,
  Lantern: LANTERN,
  Moss: MOSS,
  Petal: PETAL,
  Plum: PLUM,
};

const WING_COLOR: Record<string, string> = {
  "Gold Feather": LANTERN,
  "Paper Feather": PAPER,
  "Moss Feather": MOSS,
  "Petal Feather": PETAL,
  Leaf: "#7CC08A",
  Bat: "#5F5E5A",
  Starlight: PAPER,
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const n = (v: number) => Math.round(v * 10) / 10;

function riso(d: string, fill: string, stroke = 2.4, dx = 3, dy = 2) {
  return (
    `<path d="${d}" fill="${fill}" transform="translate(${dx} ${dy})"/>` +
    `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`
  );
}

function line(d: string, w = 2) {
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function star4(cx: number, cy: number, r: number, fill: string) {
  const k = r * 0.28;
  return `<path d="M${n(cx)} ${n(cy - r)} C ${n(cx + k)} ${n(cy - k)}, ${n(cx + k)} ${n(cy - k)}, ${n(cx + r)} ${n(cy)} C ${n(cx + k)} ${n(cy + k)}, ${n(cx + k)} ${n(cy + k)}, ${n(cx)} ${n(cy + r)} C ${n(cx - k)} ${n(cy + k)}, ${n(cx - k)} ${n(cy + k)}, ${n(cx - r)} ${n(cy)} C ${n(cx - k)} ${n(cy - k)}, ${n(cx - k)} ${n(cy - k)}, ${n(cx)} ${n(cy - r)} Z" fill="${fill}"/>`;
}

// --------------------------------------------------------------- scenery

function sky(t: Traits, rand: () => number) {
  const bg = BACKGROUNDS[t.Background] ?? BACKGROUNDS.Midnight;
  let s = `<rect width="400" height="400" fill="${bg.sky}"/>`;
  // paper grain
  for (let i = 0; i < 260; i++) {
    s += `<circle cx="${n(rand() * 400)}" cy="${n(rand() * 400)}" r="${n(0.4 + rand() * 0.6)}" fill="${bg.dark ? PAPER : INK}" opacity="${bg.dark ? 0.12 : 0.14}"/>`;
  }
  if (bg.dark) {
    for (let i = 0; i < 14; i++) {
      const x = 16 + rand() * 368;
      const y = 14 + rand() * 170;
      s += star4(x, y, 3 + rand() * 4, rand() < 0.3 ? LANTERN : PAPER);
    }
    // crescent moon
    const mx = rand() < 0.5 ? 320 : 80;
    s += `<circle cx="${mx}" cy="70" r="30" fill="${PAPER}"/><circle cx="${mx + 13}" cy="62" r="27" fill="${bg.sky}"/>`;
  } else {
    // soft sun disc + ink sparkles
    s += `<circle cx="318" cy="76" r="34" fill="${LANTERN}" opacity="0.85"/>`;
    s += line("M318 30 L318 22 M318 130 L318 122 M272 76 L264 76 M372 76 L364 76", 2);
    for (let i = 0; i < 6; i++) {
      const x = 30 + rand() * 200;
      const y = 30 + rand() * 120;
      s += line(`M${n(x - 4)} ${n(y)} L${n(x + 4)} ${n(y)} M${n(x)} ${n(y - 4)} L${n(x)} ${n(y + 4)}`, 1.4);
    }
  }
  return s;
}

function isle(t: Traits) {
  // drawn in a 320x230 box, placed at (40, 262) scaled 1.0
  let g = "";
  if (t.Isle === "Cloud Bank") {
    g += riso(
      "M30 70 C 10 68, 12 40, 40 40 C 40 16, 84 6, 104 28 C 118 0, 176 -2, 188 30 C 214 16, 252 26, 250 50 C 282 44, 308 60, 292 78 C 210 92, 100 90, 30 70 Z",
      PAPER,
      2.4,
    );
    return `<g transform="translate(40 290)">${g}</g>`;
  }
  g += line("M118 168 C 116 186, 122 196, 118 214", 1.6);
  g += line("M150 196 C 152 208, 146 216, 150 228", 1.6);
  g += line("M196 170 C 200 184, 194 192, 198 206", 1.6);
  g += riso("M22 86 C 52 116, 92 168, 126 182 C 140 200, 166 206, 178 190 C 214 170, 262 126, 300 88 Z", TIDE);
  g += `<path d="M60 104 C 110 114, 210 112, 270 102 M90 136 C 140 146, 196 142, 236 132" fill="none" stroke="${INK}" stroke-width="1.2" opacity="0.6" stroke-linecap="round"/>`;
  g += riso("M18 84 C 34 66, 98 58, 158 60 C 222 58, 288 64, 304 84 C 270 96, 54 98, 18 84 Z", MOSS);
  g += line("M40 80 l4 -7 l3 7 M262 78 l4 -7 l3 7", 1.4);
  if (t.Isle === "Grove") {
    g += line("M44 74 C 44 58, 46 46, 44 32", 2.2);
    g += riso("M26 38 C 20 18, 46 6, 58 20 C 72 16, 78 36, 64 44 C 58 54, 30 52, 26 38 Z", MOSS);
    g += line("M276 72 C 276 60, 278 52, 276 42", 2.2);
    g += riso("M262 46 C 256 30, 278 20, 288 32 C 300 32, 300 50, 286 54 C 278 60, 262 58, 262 46 Z", PETAL);
  } else if (t.Isle === "Lantern Reach") {
    g += line("M262 74 L262 26 C 272 22, 282 26, 284 34", 2.2);
    g += riso("M276 34 L292 34 L296 52 L272 52 Z", LANTERN, 2);
    g += line("M280 40 L288 40 M279 46 L289 46", 1.2);
  }
  return `<g transform="translate(40 262)">${g}</g>`;
}

// --------------------------------------------------------------- the cat (240x240 space)

function wings(t: Traits) {
  const c = WING_COLOR[t.Wings] ?? LANTERN;
  if (t.Wings === "Bat") {
    return (
      riso("M100 150 L42 104 L52 132 L30 134 L50 154 L36 170 L100 176 Z", c) +
      riso("M140 150 L198 104 L188 132 L210 134 L190 154 L204 170 L140 176 Z", c)
    );
  }
  if (t.Wings === "Leaf") {
    return (
      `<g transform="rotate(-32 70 130)">${riso("M30 130 C 40 108, 92 104, 110 130 C 92 154, 40 152, 30 130 Z", c)}${line("M34 130 L106 130", 1.2)}</g>` +
      `<g transform="rotate(32 170 130)">${riso("M130 130 C 148 108, 200 104, 210 130 C 200 152, 148 154, 130 130 Z", c)}${line("M134 130 L206 130", 1.2)}</g>`
    );
  }
  let s =
    riso("M90 152 C 58 146, 36 118, 40 90 C 54 102, 63 100, 69 94 C 66 110, 74 120, 84 124 C 80 112, 86 104, 92 102 C 94 118, 98 130, 104 138 Z", c) +
    riso("M150 152 C 182 146, 204 118, 200 90 C 186 102, 177 100, 171 94 C 174 110, 166 120, 156 124 C 160 112, 154 104, 148 102 C 146 118, 142 130, 136 138 Z", c);
  if (t.Wings === "Starlight") {
    s += star4(56, 104, 5, LANTERN) + star4(72, 128, 4, LANTERN) + star4(184, 104, 5, LANTERN) + star4(168, 128, 4, LANTERN);
  }
  return s;
}

function eyes(t: Traits) {
  const open = (cx: number, iris?: string) =>
    `<ellipse cx="${cx}" cy="95" rx="5.6" ry="7.4" fill="${iris ?? INK}"/>` +
    (iris ? `<ellipse cx="${cx}" cy="96" rx="2.6" ry="5" fill="${INK}"/>` : "") +
    `<circle cx="${cx + 2}" cy="92" r="1.9" fill="${PAPER}"/>`;
  const shut = (x: number) => line(`M${x - 6} 96 C ${x - 2} 101, ${x + 4} 101, ${x + 7} 96`, 2.4);
  switch (t.Eyes) {
    case "Sleepy":
      return shut(104.5) + shut(135.5);
    case "Wink":
      return open(104.5) + shut(135.5);
    case "Starry":
      return star4(104.5, 95, 7, LANTERN) + star4(135.5, 95, 7, LANTERN);
    case "Heterochromia":
      return open(104.5, "#378ADD") + open(135.5, LANTERN);
    default:
      return open(104.5) + open(135.5);
  }
}

function mark(t: Traits) {
  switch (t.Mark) {
    case "Crescent":
      return `<path d="M118 66 C 112 70, 112 80, 120 83 C 115 78, 115 71, 122 67 Z" fill="${LANTERN}" stroke="${INK}" stroke-width="1.2"/>`;
    case "Star":
      return star4(120, 74, 6, LANTERN);
    case "Full Moon":
      return `<circle cx="120" cy="74" r="5.5" fill="${PAPER}" stroke="${INK}" stroke-width="1.2"/>`;
    default:
      return "";
  }
}

function scarf(t: Traits) {
  const c = SCARF[t.Scarf];
  if (!c) return "";
  return (
    riso("M86 126 C 104 136, 136 136, 154 126 L156 138 C 136 147, 104 147, 84 138 Z", c) +
    riso("M136 140 L150 141 L154 168 L140 164 Z", c, 2)
  );
}

function accessory(t: Traits) {
  switch (t.Accessory) {
    case "Bell":
      return riso("M113 146 C 113 139, 127 139, 127 146 C 127 154, 113 154, 113 146 Z", LANTERN, 1.8, 1, 1) + line("M116 149 L124 149", 1.2);
    case "Sprout":
      return (
        line("M120 58 C 120 48, 122 42, 120 34", 2.2) +
        riso("M120 42 C 108 30, 98 36, 100 44 C 108 48, 116 46, 120 42 Z", "#7CC08A", 1.8, 1.5, 1) +
        riso("M121 38 C 132 26, 144 30, 142 38 C 134 44, 126 42, 121 38 Z", "#7CC08A", 1.8, 1.5, 1)
      );
    case "Flower Crown": {
      let s = "";
      const pts: [number, number, string][] = [
        [90, 70, PETAL], [102, 62, LANTERN], [120, 58, PETAL], [138, 62, MOSS], [150, 70, LANTERN],
      ];
      for (const [x, y, c] of pts) {
        s += `<circle cx="${x + 1}" cy="${y + 1}" r="6.5" fill="${c}"/><circle cx="${x}" cy="${y}" r="6.5" fill="none" stroke="${INK}" stroke-width="1.6"/><circle cx="${x}" cy="${y}" r="2" fill="${INK}"/>`;
      }
      return s;
    }
    case "Witch Hat":
      return (
        riso("M72 66 C 92 56, 148 56, 168 66 C 150 74, 90 74, 72 66 Z", PLUM) +
        riso("M96 64 L118 6 C 124 2, 132 8, 128 14 L146 62 Z", PLUM) +
        line("M100 54 C 114 50, 130 50, 142 54", 3)
      );
    case "Star Crown":
      return (
        riso("M94 64 L92 38 L106 50 L120 30 L134 50 L148 38 L146 64 Z", LANTERN) +
        star4(120, 46, 4, EMBER)
      );
    default:
      return "";
  }
}

function cat(t: Traits) {
  const fur = FUR[t.Fur] ?? FUR.Parchment;
  let s = "";
  // tail
  const tail = "M156 202 C 196 204, 214 176, 200 150 C 196 142, 188 146, 192 154 C 200 172, 186 190, 152 188";
  s += `<path d="${tail}" fill="${fur}" transform="translate(3 2)"/>` + line(tail, 2.4);
  s += wings(t);
  s += riso("M82 206 C 70 172, 84 130, 120 127 C 158 129, 172 172, 159 206 C 140 212, 100 212, 82 206 Z", fur);
  s += `<path d="M104 160 C 110 176, 112 190, 108 204 M136 160 C 130 176, 128 190, 132 204" fill="none" stroke="${INK}" stroke-width="1.2" stroke-linecap="round" opacity="0.55"/>`;
  s += riso("M96 204 C 94 196, 112 194, 114 203 C 110 209, 100 210, 96 204 Z", fur, 2);
  s += riso("M126 203 C 128 194, 146 196, 144 204 C 140 210, 130 209, 126 203 Z", fur, 2);
  s += riso("M86 80 C 82 64, 80 50, 84 38 C 96 46, 104 54, 110 62 Z", fur);
  s += riso("M154 80 C 158 64, 160 50, 156 38 C 144 46, 136 54, 130 62 Z", fur);
  s += `<path d="M89 72 C 88 62, 88 54, 89 48 C 95 53, 99 57, 102 62 Z" fill="${PETAL}"/>`;
  s += `<path d="M151 72 C 152 62, 152 54, 151 48 C 145 53, 141 57, 138 62 Z" fill="${PETAL}"/>`;
  s += riso("M78 99 C 75 72, 96 57, 121 57 C 146 58, 166 72, 162 100 C 160 121, 142 132, 119 131 C 97 131, 80 120, 78 99 Z", fur);
  s += mark(t);
  s += eyes(t);
  s += `<ellipse cx="94" cy="110" rx="7" ry="4" fill="${PETAL}" opacity="0.8"/><ellipse cx="146" cy="110" rx="7" ry="4" fill="${PETAL}" opacity="0.8"/>`;
  s += `<path d="M116 105 L124 105 L120 110 Z" fill="${EMBER}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`;
  s += line("M120 110 C 118 115, 113 116, 111 113 M120 110 C 122 115, 127 116, 129 113", 1.6);
  s += line("M82 104 L64 100 M82 110 L63 112 M158 104 L176 100 M158 110 L177 112", 1.2);
  s += scarf(t);
  s += accessory(t);
  return `<g transform="translate(80 104)">${s}</g>`;
}

export function renderToken(traits: Traits, seed: number): string {
  const rand = mulberry32(seed);
  const body = sky(traits, rand) + isle(traits) + cat(traits);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="1000" height="1000">${body}</svg>`;
}

/** Image shown for tokens that are not minted / revealed yet. */
export function renderHidden(): string {
  const rand = mulberry32(7);
  let s = `<rect width="400" height="400" fill="#12142B"/>`;
  for (let i = 0; i < 18; i++) s += star4(16 + rand() * 368, 14 + rand() * 360, 2 + rand() * 4, rand() < 0.3 ? LANTERN : PAPER);
  s += `<circle cx="200" cy="170" r="92" fill="${PAPER}"/><circle cx="236" cy="150" r="84" fill="#12142B"/>`;
  s += `<text x="200" y="330" text-anchor="middle" font-family="Georgia, serif" font-size="30" fill="${PAPER}">A Lunetta is sleeping...</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="1000" height="1000">${s}</svg>`;
}
