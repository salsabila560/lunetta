/**
 * Original hand-inked illustrations for Lunetta.
 * Style rules: one ink outline colour, flat "risograph" fills that sit slightly
 * off-register from the line, deliberately uneven curves. All paths are
 * authored for this project — no third-party art.
 */
import type { SVGProps } from "react";

export const INK = "#12142B";
const PAPER = "#F3ECDC";
const PARCHMENT = "#E7DCC2";
const LANTERN = "#F2C94C";
const MOSS = "#5DCAA5";
const PETAL = "#F4A0BC";
const EMBER = "#E8704A";
const TIDE = "#3E4A9A";

/** A filled shape printed 3px off-register, with the ink line on top. */
function Riso({ d, fill, stroke = 2.4, offset = [3, 2] }: { d: string; fill: string; stroke?: number; offset?: [number, number] }) {
  return (
    <>
      <path d={d} fill={fill} transform={`translate(${offset[0]} ${offset[1]})`} />
      <path d={d} fill="none" stroke={INK} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

function Line({ d, w = 2 }: { d: string; w?: number }) {
  return <path d={d} fill="none" stroke={INK} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />;
}

// ---------------------------------------------------------------------------
// Lunetta — the moon-cat guardian
// ---------------------------------------------------------------------------

export type CatPalette = { fur: string; wing: string; scarf: string };
export const CAT_PALETTES: Record<string, CatPalette> = {
  paper: { fur: PARCHMENT, wing: LANTERN, scarf: EMBER },
  dusk: { fur: "#B9B4D8", wing: MOSS, scarf: LANTERN },
  ember: { fur: "#F0A27E", wing: PAPER, scarf: TIDE },
  petal: { fur: PETAL, wing: LANTERN, scarf: MOSS },
};

export function LunettaCat({
  palette = CAT_PALETTES.paper,
  sleeping = false,
  ...props
}: SVGProps<SVGSVGElement> & { palette?: CatPalette; sleeping?: boolean }) {
  const { fur, wing, scarf } = palette;
  return (
    <svg viewBox="0 0 240 240" role="img" {...props}>
      <title>Lunetta, a winged moon-cat</title>
      {/* tail */}
      <path d="M156 202 C 196 204, 214 176, 200 150 C 196 142, 188 146, 192 154 C 200 172, 186 190, 152 188" fill={fur} transform="translate(3 2)" />
      <Line d="M156 202 C 196 204, 214 176, 200 150 C 196 142, 188 146, 192 154 C 200 172, 186 190, 152 188" w={2.4} />
      {/* wings */}
      <Riso fill={wing} d="M90 152 C 58 146, 36 118, 40 90 C 54 102, 63 100, 69 94 C 66 110, 74 120, 84 124 C 80 112, 86 104, 92 102 C 94 118, 98 130, 104 138 Z" />
      <Riso fill={wing} d="M150 152 C 182 146, 204 118, 200 90 C 186 102, 177 100, 171 94 C 174 110, 166 120, 156 124 C 160 112, 154 104, 148 102 C 146 118, 142 130, 136 138 Z" />
      {/* body */}
      <Riso fill={fur} d="M82 206 C 70 172, 84 130, 120 127 C 158 129, 172 172, 159 206 C 140 212, 100 212, 82 206 Z" />
      <path d="M104 160 C 110 176, 112 190, 108 204 M136 160 C 130 176, 128 190, 132 204" fill="none" stroke={INK} strokeWidth={1.2} strokeLinecap="round" opacity={0.55} />
      {/* paws */}
      <Riso fill={fur} stroke={2} d="M96 204 C 94 196, 112 194, 114 203 C 110 209, 100 210, 96 204 Z" />
      <Riso fill={fur} stroke={2} d="M126 203 C 128 194, 146 196, 144 204 C 140 210, 130 209, 126 203 Z" />
      {/* ears */}
      <Riso fill={fur} d="M86 80 C 82 64, 80 50, 84 38 C 96 46, 104 54, 110 62 Z" />
      <Riso fill={fur} d="M154 80 C 158 64, 160 50, 156 38 C 144 46, 136 54, 130 62 Z" />
      <path d="M89 72 C 88 62, 88 54, 89 48 C 95 53, 99 57, 102 62 Z" fill={PETAL} />
      <path d="M151 72 C 152 62, 152 54, 151 48 C 145 53, 141 57, 138 62 Z" fill={PETAL} />
      {/* head */}
      <Riso fill={fur} d="M78 99 C 75 72, 96 57, 121 57 C 146 58, 166 72, 162 100 C 160 121, 142 132, 119 131 C 97 131, 80 120, 78 99 Z" />
      {/* forehead crescent */}
      <path d="M118 66 C 112 70, 112 80, 120 83 C 115 78, 115 71, 122 67 Z" fill={LANTERN} stroke={INK} strokeWidth={1.2} />
      {/* eyes */}
      {sleeping ? (
        <>
          <Line d="M98 96 C 102 101, 108 101, 111 96" w={2.4} />
          <Line d="M129 96 C 132 101, 138 101, 142 96" w={2.4} />
        </>
      ) : (
        <>
          <ellipse cx="104.5" cy="95" rx="5.6" ry="7.4" fill={INK} />
          <ellipse cx="135.5" cy="95" rx="5.6" ry="7.4" fill={INK} />
          <circle cx="106.5" cy="92" r="1.9" fill={PAPER} />
          <circle cx="137.5" cy="92" r="1.9" fill={PAPER} />
        </>
      )}
      {/* cheeks */}
      <ellipse cx="94" cy="110" rx="7" ry="4" fill={PETAL} opacity={0.8} />
      <ellipse cx="146" cy="110" rx="7" ry="4" fill={PETAL} opacity={0.8} />
      {/* nose + mouth */}
      <path d="M116 105 L124 105 L120 110 Z" fill={EMBER} stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
      <Line d="M120 110 C 118 115, 113 116, 111 113 M120 110 C 122 115, 127 116, 129 113" w={1.6} />
      {/* whiskers */}
      <Line d="M82 104 L64 100 M82 110 L63 112 M158 104 L176 100 M158 110 L177 112" w={1.2} />
      {/* scarf */}
      <Riso fill={scarf} d="M86 126 C 104 136, 136 136, 154 126 L156 138 C 136 147, 104 147, 84 138 Z" />
      <Riso fill={scarf} d="M136 140 L150 141 L154 168 L140 164 Z" stroke={2} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Floating isle
// ---------------------------------------------------------------------------

export function FloatingIsle({
  variant = "grove",
  ...props
}: SVGProps<SVGSVGElement> & { variant?: "grove" | "lantern" | "bare" }) {
  return (
    <svg viewBox="0 0 320 230" aria-hidden="true" {...props}>
      {/* dangling roots */}
      <Line d="M118 168 C 116 186, 122 196, 118 214" w={1.6} />
      <Line d="M150 196 C 152 208, 146 216, 150 228" w={1.6} />
      <Line d="M196 170 C 200 184, 194 192, 198 206" w={1.6} />
      <Line d="M232 134 C 236 146, 232 152, 236 162" w={1.4} />
      {/* rock underside */}
      <Riso fill={TIDE} d="M22 86 C 52 116, 92 168, 126 182 C 140 200, 166 206, 178 190 C 214 170, 262 126, 300 88 Z" />
      <path d="M60 104 C 110 114, 210 112, 270 102 M90 136 C 140 146, 196 142, 236 132 M126 164 C 150 170, 176 168, 196 160" fill="none" stroke={INK} strokeWidth={1.2} opacity={0.6} strokeLinecap="round" />
      {/* grass top */}
      <Riso fill={MOSS} d="M18 84 C 34 66, 98 58, 158 60 C 222 58, 288 64, 304 84 C 270 96, 54 98, 18 84 Z" />
      <Line d="M40 80 l4 -7 l3 7 M88 76 l3 -6 l3 6 M262 78 l4 -7 l3 7 M226 74 l3 -6 l3 6" w={1.4} />
      {variant === "grove" && (
        <>
          <Line d="M98 72 C 98 56, 100 44, 98 30" w={2.2} />
          <Riso fill={MOSS} d="M80 36 C 74 16, 100 4, 112 18 C 126 14, 132 34, 118 42 C 112 52, 84 50, 80 36 Z" />
          <Line d="M210 70 C 210 58, 212 50, 210 40" w={2.2} />
          <Riso fill={PETAL} d="M196 44 C 190 28, 212 18, 222 30 C 234 30, 234 48, 220 52 C 212 58, 196 56, 196 44 Z" />
        </>
      )}
      {variant === "lantern" && (
        <>
          <Line d="M150 70 L150 22 C 160 18, 170 22, 172 30" w={2.2} />
          <Riso fill={LANTERN} d="M164 30 L180 30 L184 48 L160 48 Z" stroke={2} />
          <Line d="M168 36 L176 36 M167 42 L177 42" w={1.2} />
          <Riso fill={PARCHMENT} d="M216 72 L216 52 L236 40 L256 52 L256 72 Z" />
          <Riso fill={EMBER} d="M210 54 L236 34 L262 54 Z" stroke={2} />
          <Riso fill={LANTERN} d="M230 60 L242 60 L242 72 L230 72 Z" stroke={1.6} />
        </>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Moon, stars, clouds
// ---------------------------------------------------------------------------

export function CrescentMoon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" {...props}>
      <path d="M128 18 C 76 20, 30 60, 30 108 C 30 158, 74 190, 124 186 C 152 184, 172 170, 182 152 C 132 162, 92 132, 92 88 C 92 56, 108 32, 128 18 Z" fill={PAPER} transform="translate(4 3)" />
      <Line d="M128 18 C 76 20, 30 60, 30 108 C 30 158, 74 190, 124 186 C 152 184, 172 170, 182 152 C 132 162, 92 132, 92 88 C 92 56, 108 32, 128 18 Z" w={2.6} />
      <circle cx="62" cy="100" r="9" fill="none" stroke={INK} strokeWidth={1.6} />
      <circle cx="84" cy="150" r="6" fill="none" stroke={INK} strokeWidth={1.4} />
      <circle cx="58" cy="136" r="3.5" fill={INK} opacity={0.5} />
      <path d="M44 120 C 48 128, 54 132, 62 132" fill="none" stroke={INK} strokeWidth={1.2} opacity={0.6} />
    </svg>
  );
}

const STAR_POINTS: [number, number, number][] = [
  [6, 14, 7], [18, 38, 5], [28, 9, 6], [41, 26, 4], [52, 6, 6], [63, 32, 5],
  [72, 12, 7], [84, 40, 4], [91, 18, 6], [12, 58, 4], [36, 52, 5], [78, 60, 4],
];

export function StarField({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${className}`}>
      {STAR_POINTS.map(([x, y, s], i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          className="absolute animate-twinkle"
          style={{ left: `${x}%`, top: `${y}%`, width: s * 3, height: s * 3, animationDelay: `${(i % 5) * 0.7}s` }}
        >
          <path d="M10 1 C 11 7, 13 9, 19 10 C 13 11, 11 13, 10 19 C 9 13, 7 11, 1 10 C 7 9, 9 7, 10 1 Z" fill={i % 3 === 0 ? LANTERN : PAPER} />
        </svg>
      ))}
    </div>
  );
}

export function Cloud(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 220 90" aria-hidden="true" {...props}>
      <Riso fill={PAPER} d="M18 70 C 4 68, 6 46, 26 46 C 26 26, 56 18, 70 34 C 80 12, 120 10, 128 36 C 146 26, 172 34, 170 52 C 192 48, 210 62, 198 74 C 140 82, 70 80, 18 70 Z" stroke={2.2} />
    </svg>
  );
}

/** Small hand-drawn wave divider between sections. */
export function InkDivider({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 1200 40" preserveAspectRatio="none" aria-hidden="true" className={className}>
      <path d="M0 22 C 80 6, 150 34, 240 20 C 330 6, 400 34, 490 20 C 580 6, 650 34, 740 20 C 830 6, 900 34, 990 20 C 1080 6, 1140 30, 1200 18 L1200 40 L0 40 Z" fill={PAPER} />
      <path d="M0 22 C 80 6, 150 34, 240 20 C 330 6, 400 34, 490 20 C 580 6, 650 34, 740 20 C 830 6, 900 34, 990 20 C 1080 6, 1140 30, 1200 18" fill="none" stroke={INK} strokeWidth={2.5} />
    </svg>
  );
}
