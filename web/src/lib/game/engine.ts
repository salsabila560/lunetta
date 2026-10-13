/**
 * Lantern Run — a small endless runner set in Halcyra.
 * Tap / Space to jump (air jumps from wings), hold to glide, Warm Light (E) to
 * clear the Hush. Collect lanterns and stars; falling or touching the Hush costs a life.
 *
 * World units: the view is always 400 units tall; width follows the canvas aspect.
 */
import type { Stats } from "./stats";

export type Hud = {
  score: number;
  lives: number;
  maxLives: number;
  skillReady: number; // 0..1
  lanterns: number;
  over: boolean;
  distance: number;
};

type Isle = { x: number; w: number; top: number; lantern: Lantern | null };
type Lantern = { lit: boolean };
type Star = { x: number; y: number; got: boolean };
type Hush = { x: number; y: number; r: number; phase: number; alive: boolean };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: string };

const H = 400;
const GRAVITY = 1500;
const JUMP_V = -540;
const MAX_FALL = 720;
const PLAYER_X = 0.26; // fraction of view width
const SIZE = 86; // sprite height in world units

const INK = "#12142B";
const PAPER = "#F3ECDC";
const LANTERN = "#F2C94C";
const MOSS = "#5DCAA5";
const TIDE = "#3E4A9A";

// Path2D only exists in the browser, so build the isle shapes lazily.
let islePaths: { rock: Path2D; grass: Path2D; lines: Path2D } | null = null;
function getIslePaths() {
  if (!islePaths) {
    islePaths = {
      rock: new Path2D("M22 86 C 52 116, 92 168, 126 182 C 140 200, 166 206, 178 190 C 214 170, 262 126, 300 88 Z"),
      grass: new Path2D("M18 84 C 34 66, 98 58, 158 60 C 222 58, 288 64, 304 84 C 270 96, 54 98, 18 84 Z"),
      lines: new Path2D("M60 104 C 110 114, 210 112, 270 102 M90 136 C 140 146, 196 142, 236 132"),
    };
  }
  return islePaths;
}

function rnd(a: number, b: number) {
  return a + Math.random() * (b - a);
}

export class LanternRun {
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private last = 0;
  private running = false;

  private scale = 1;
  private W = 600;

  private speed = 175;
  private t = 0;
  private distance = 0;
  private score = 0;
  private lanterns = 0;
  private lives: number;

  private py = 120;
  private vy = 0;
  private jumpsLeft: number;
  private holding = false;
  private grounded = false;
  private invuln = 0;
  private skillTimer = 0;
  private ring = 0; // Warm Light ring animation 0..1

  private isles: Isle[] = [];
  private stars: Star[] = [];
  private hush: Hush[] = [];
  private sparks: Spark[] = [];
  private bgStars: { x: number; y: number; r: number; d: number }[] = [];
  private nextHush = 3;
  private hudTimer = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private sprite: HTMLImageElement,
    private stats: Stats,
    private sky: string,
    private onHud: (h: Hud) => void,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    this.ctx = ctx;
    this.lives = stats.lives;
    this.jumpsLeft = stats.maxJumps;
    this.resize();
    for (let i = 0; i < 60; i++) this.bgStars.push({ x: Math.random() * 2000, y: Math.random() * 260, r: rnd(0.6, 2), d: rnd(0.05, 0.25) });
    this.reset();
  }

  // ------------------------------------------------------------ lifecycle

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.scale = this.canvas.height / H;
    this.W = this.canvas.width / this.scale;
  }

  private reset() {
    this.isles = [];
    let x = -40;
    // a long, safe first isle
    this.isles.push({ x, w: this.W * 0.7, top: 300, lantern: null });
    x += this.W * 0.7;
    while (x < this.W + 400) x = this.spawnIsle(x);
    this.py = 300;
    this.vy = 0;
    this.grounded = true;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.033, (now - this.last) / 1000);
      this.last = now;
      this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  pause() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  destroy() {
    this.pause();
  }

  // ------------------------------------------------------------ input

  press() {
    this.holding = true;
    if (this.lives <= 0) return;
    if (this.grounded || this.jumpsLeft > 0) {
      if (!this.grounded) this.jumpsLeft -= 1;
      this.vy = JUMP_V * (this.grounded ? 1 : 0.88);
      this.grounded = false;
      this.puff(this.px(), this.py, PAPER, 6);
    }
  }

  release() {
    this.holding = false;
  }

  skill() {
    if (this.lives <= 0 || this.skillTimer > 0) return;
    this.skillTimer = this.stats.skillCooldown;
    this.ring = 0.0001;
    const cx = this.px();
    const cy = this.py - SIZE * 0.45;
    for (const h of this.hush) {
      if (h.alive && Math.hypot(h.x - cx, h.y - cy) < this.stats.skillRadius + h.r) {
        h.alive = false;
        this.score += 5 * this.stats.scoreMult;
        this.puff(h.x, h.y, "#B9B4D8", 14);
      }
    }
  }

  // ------------------------------------------------------------ world

  private px() {
    return this.W * PLAYER_X;
  }

  private spawnIsle(fromX: number) {
    const gap = rnd(60, 95) + (this.speed - 175) * 0.45 + Math.random() * 60;
    const w = rnd(120, 250);
    const prevTop = this.isles.length ? this.isles[this.isles.length - 1].top : 300;
    const top = Math.max(210, Math.min(340, prevTop + rnd(-70, 60)));
    const x = fromX + gap;
    const isle: Isle = { x, w, top, lantern: Math.random() < 0.6 ? { lit: false } : null };
    this.isles.push(isle);
    // an arc of stars over the gap
    if (Math.random() < 0.55) {
      const n = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const f = (i + 1) / (n + 1);
        this.stars.push({ x: fromX + gap * f, y: Math.min(prevTop, top) - 60 - Math.sin(f * Math.PI) * 50, got: false });
      }
    }
    return x + w;
  }

  private loseLife() {
    if (this.invuln > 0) return;
    this.lives -= 1;
    this.invuln = 1.6;
    this.puff(this.px(), this.py - 30, "#E8704A", 16);
    if (this.lives <= 0) {
      this.lives = 0;
      this.emitHud(true);
    }
  }

  private puff(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      this.sparks.push({ x, y, vx: rnd(-120, 120), vy: rnd(-160, 40), life: rnd(0.4, 0.8), color });
    }
  }

  private update(dt: number) {
    if (this.lives <= 0) {
      // let sparks finish, world stops
      this.sparks = this.sparks.filter((s) => (s.life -= dt) > 0);
      return;
    }
    this.t += dt;
    this.speed = Math.min(360, 175 + this.t * 3.2);
    const dx = this.speed * dt;
    this.distance += dx;
    this.score += dx * 0.02 * this.stats.scoreMult;

    // scroll
    for (const i of this.isles) i.x -= dx;
    for (const s of this.stars) s.x -= dx;
    for (const s of this.bgStars) s.x -= dx * s.d;
    this.isles = this.isles.filter((i) => i.x + i.w > -60);
    this.stars = this.stars.filter((s) => s.x > -40 && !s.got);
    let right = this.isles.length ? this.isles[this.isles.length - 1].x + this.isles[this.isles.length - 1].w : 0;
    while (right < this.W + 400) right = this.spawnIsle(right);

    // player physics
    const prevFeet = this.py;
    this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
    if (this.holding && this.vy > 0) this.vy = Math.min(this.vy, this.stats.glideFall);
    this.py += this.vy * dt;
    this.grounded = false;
    const x = this.px();
    for (const isle of this.isles) {
      const onX = x + 14 > isle.x + 10 && x - 14 < isle.x + isle.w - 10;
      if (onX && this.vy >= 0 && prevFeet <= isle.top + 2 && this.py >= isle.top) {
        this.py = isle.top;
        this.vy = 0;
        this.grounded = true;
        this.jumpsLeft = this.stats.maxJumps - 1;
        if (isle.lantern && !isle.lantern.lit) {
          isle.lantern.lit = true;
          this.lanterns += 1;
          this.score += (10 + this.stats.lanternBonus) * this.stats.scoreMult;
          this.puff(isle.x + isle.w * 0.72, isle.top - 40, LANTERN, 12);
        }
      }
    }
    if (this.py > H + 80) {
      // fell into the Cloudsea: lose a life and get rescued onto a fresh isle
      this.loseLife();
      if (this.lives > 0) {
        this.isles.push({ x: x - 70, w: 180, top: 260, lantern: null });
        this.isles.sort((a, b) => a.x - b.x);
        this.py = 120;
        this.vy = 0;
      }
    }

    // lanterns light from nearby too (magnet)
    for (const isle of this.isles) {
      if (isle.lantern && !isle.lantern.lit) {
        const lx = isle.x + isle.w * 0.72;
        const ly = isle.top - 40;
        if (Math.hypot(lx - x, ly - (this.py - SIZE * 0.4)) < this.stats.magnet + 20) {
          isle.lantern.lit = true;
          this.lanterns += 1;
          this.score += (10 + this.stats.lanternBonus) * this.stats.scoreMult;
          this.puff(lx, ly, LANTERN, 12);
        }
      }
    }
    for (const s of this.stars) {
      if (!s.got && Math.hypot(s.x - x, s.y - (this.py - SIZE * 0.45)) < this.stats.magnet + 14) {
        s.got = true;
        this.score += 2 * this.stats.scoreMult;
        this.puff(s.x, s.y, PAPER, 5);
      }
    }

    // the Hush
    this.nextHush -= dt;
    if (this.nextHush <= 0) {
      this.nextHush = Math.max(1.1, rnd(2.2, 3.8) - this.t * 0.012);
      this.hush.push({ x: this.W + 60, y: rnd(110, 320), r: rnd(20, 30), phase: Math.random() * 6, alive: true });
    }
    for (const h of this.hush) {
      h.x -= (this.speed + 70) * this.stats.hushSpeed * dt;
      h.phase += dt * 2;
      h.y += Math.sin(h.phase) * 24 * dt;
      if (h.alive && this.invuln <= 0) {
        const cx = x;
        const cy = this.py - SIZE * 0.45;
        if (Math.hypot(h.x - cx, h.y - cy) < h.r + 22) {
          h.alive = false;
          this.loseLife();
        }
      }
    }
    this.hush = this.hush.filter((h) => h.x > -80 && h.alive);

    // timers
    this.invuln = Math.max(0, this.invuln - dt);
    this.skillTimer = Math.max(0, this.skillTimer - dt);
    if (this.ring > 0) this.ring = this.ring + dt * 2.5 > 1 ? 0 : this.ring + dt * 2.5;
    this.sparks = this.sparks.filter((s) => {
      s.life -= dt;
      s.x += s.vx * dt - dx;
      s.y += s.vy * dt;
      s.vy += 400 * dt;
      return s.life > 0;
    });

    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.1;
      this.emitHud(false);
    }
  }

  private emitHud(over: boolean) {
    this.onHud({
      score: Math.floor(this.score),
      lives: this.lives,
      maxLives: this.stats.lives,
      skillReady: 1 - this.skillTimer / this.stats.skillCooldown,
      lanterns: this.lanterns,
      over,
      distance: Math.floor(this.distance / 10),
    });
  }

  // ------------------------------------------------------------ drawing

  private draw() {
    const c = this.ctx;
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0);

    // sky
    c.fillStyle = this.sky;
    c.fillRect(0, 0, this.W, H);
    for (const s of this.bgStars) {
      const x = ((s.x % (this.W + 40)) + this.W + 40) % (this.W + 40);
      c.fillStyle = s.r > 1.5 ? LANTERN : PAPER;
      c.globalAlpha = 0.5 + 0.5 * Math.sin(this.t * 2 + s.x);
      c.beginPath();
      c.arc(x, s.y, s.r, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
    // moon
    c.fillStyle = PAPER;
    c.beginPath();
    c.arc(this.W - 70, 64, 28, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = this.sky;
    c.beginPath();
    c.arc(this.W - 58, 56, 25, 0, Math.PI * 2);
    c.fill();
    // cloudsea
    c.fillStyle = "rgba(243,236,220,0.07)";
    for (let i = 0; i < 8; i++) {
      const x = ((i * 140 - this.distance * 0.3) % (this.W + 200)) + (this.W + 200);
      c.beginPath();
      c.arc((x % (this.W + 200)) - 100, H - 6, 70, 0, Math.PI * 2);
      c.fill();
    }

    // isles
    for (const isle of this.isles) this.drawIsle(isle);

    // stars
    for (const s of this.stars) if (!s.got) this.star(s.x, s.y, 7, LANTERN);

    // hush
    for (const h of this.hush) this.drawHush(h);
    if (this.stats.foresight) {
      for (const h of this.hush) {
        if (h.x > this.W - 10) {
          c.fillStyle = "rgba(232,112,74,0.85)";
          c.beginPath();
          c.moveTo(this.W - 8, h.y);
          c.lineTo(this.W - 22, h.y - 9);
          c.lineTo(this.W - 22, h.y + 9);
          c.closePath();
          c.fill();
        }
      }
    }

    // warm light ring
    if (this.ring > 0) {
      c.strokeStyle = LANTERN;
      c.globalAlpha = 1 - this.ring;
      c.lineWidth = 6;
      c.beginPath();
      c.arc(this.px(), this.py - SIZE * 0.45, this.stats.skillRadius * this.ring, 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = 1;
    }

    // player
    if (this.lives > 0 && !(this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0)) {
      const h = SIZE;
      const w = SIZE * (240 / 270);
      const tilt = Math.max(-0.25, Math.min(0.25, this.vy / 2000));
      c.save();
      c.translate(this.px(), this.py);
      c.rotate(tilt);
      c.drawImage(this.sprite, -w / 2, -h * (236 / 270), w, h);
      c.restore();
    }

    // sparks
    for (const s of this.sparks) {
      c.globalAlpha = Math.max(0, Math.min(1, s.life * 2));
      c.fillStyle = s.color;
      c.beginPath();
      c.arc(s.x, s.y, 3, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  private drawIsle(isle: Isle) {
    const c = this.ctx;
    const { rock: ISLE_ROCK, grass: ISLE_GRASS, lines: ISLE_LINES } = getIslePaths();
    const k = isle.w / 300;
    const ky = Math.min(k, 0.72); // keep wide isles from getting absurdly deep
    c.save();
    c.translate(isle.x - 18 * k, isle.top - 70 * ky);
    c.scale(k, ky);
    c.lineJoin = "round";
    c.lineCap = "round";
    // riso offset fill + ink line
    c.save();
    c.translate(3, 2);
    c.fillStyle = TIDE;
    c.fill(ISLE_ROCK);
    c.fillStyle = MOSS;
    c.fill(ISLE_GRASS);
    c.restore();
    c.strokeStyle = INK;
    c.lineWidth = 2.4 / Math.max(k, ky);
    c.stroke(ISLE_ROCK);
    c.globalAlpha = 0.5;
    c.lineWidth = 1.2 / Math.max(k, ky);
    c.stroke(ISLE_LINES);
    c.globalAlpha = 1;
    c.lineWidth = 2.4 / Math.max(k, ky);
    c.stroke(ISLE_GRASS);
    c.restore();

    if (isle.lantern) {
      const lx = isle.x + isle.w * 0.72;
      const ty = isle.top;
      c.strokeStyle = PAPER;
      c.lineWidth = 2.2;
      c.beginPath();
      c.moveTo(lx, ty - 2);
      c.lineTo(lx, ty - 46);
      c.quadraticCurveTo(lx + 10, ty - 50, lx + 12, ty - 42);
      c.stroke();
      if (isle.lantern.lit) {
        c.fillStyle = "rgba(242,201,76,0.28)";
        c.beginPath();
        c.arc(lx + 12, ty - 30, 24, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = isle.lantern.lit ? LANTERN : "#5F5E5A";
      c.fillRect(lx + 5, ty - 40, 14, 18);
      c.strokeStyle = INK;
      c.strokeRect(lx + 5, ty - 40, 14, 18);
    }
  }

  private drawHush(h: Hush) {
    const c = this.ctx;
    c.fillStyle = "rgba(185,180,168,0.9)";
    for (const [ox, oy, rr] of [
      [-0.6, 0.15, 0.75],
      [0.55, 0.2, 0.7],
      [0, -0.2, 1],
    ] as const) {
      c.beginPath();
      c.arc(h.x + ox * h.r, h.y + oy * h.r, rr * h.r, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = INK;
    c.beginPath();
    c.arc(h.x - h.r * 0.3, h.y - h.r * 0.1, 3, 0, Math.PI * 2);
    c.arc(h.x + h.r * 0.3, h.y - h.r * 0.1, 3, 0, Math.PI * 2);
    c.fill();
  }

  private star(x: number, y: number, r: number, color: string) {
    const c = this.ctx;
    const k = r * 0.3;
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(x, y - r);
    c.quadraticCurveTo(x + k, y - k, x + r, y);
    c.quadraticCurveTo(x + k, y + k, x, y + r);
    c.quadraticCurveTo(x - k, y + k, x - r, y);
    c.quadraticCurveTo(x - k, y - k, x, y - r);
    c.fill();
  }
}
