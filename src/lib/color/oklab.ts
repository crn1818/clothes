/**
 * Conversoes de cor em OKLab / OKLCh.
 *
 * Todo o app raciocina sobre cor em OKLab, nao em RGB nem HSL: e o unico dos
 * tres em que "distancia numerica" bate com "distancia que o olho percebe".
 * Isso importa em dois lugares criticos — agrupar os pixels de uma foto em
 * cores dominantes (k-means) e escolher o nome mais proximo no dicionario.
 * Em HSL, um azul-marinho e um preto ficam longe demais e dois beges quase
 * iguais ficam longe um do outro; em OKLab isso nao acontece.
 *
 * Referencia: Bjorn Ottosson, "A perceptual color space for image processing".
 */

export interface RGB {
  r: number; // 0..255
  g: number;
  b: number;
}

export interface Lab {
  L: number; // 0..1
  a: number;
  b: number;
}

export interface LCh {
  L: number; // 0..1  luminosidade
  C: number; // 0..~0.4 croma (saturacao perceptual)
  h: number; // 0..360 matiz, em graus
}

/* ---------- sRGB <-> linear ---------- */

function toLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function fromLinear(v: number): number {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(c * 255)));
}

/* ---------- sRGB <-> OKLab ---------- */

export function rgbToLab(rgb: RGB): Lab {
  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

export function labToRgb(lab: Lab): RGB {
  const l_ = lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
  const m_ = lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
  const s_ = lab.L - 0.0894841775 * lab.a - 1.291485548 * lab.b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return {
    r: fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

/* ---------- OKLab <-> OKLCh ---------- */

export function labToLch(lab: Lab): LCh {
  const C = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  let h = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L: lab.L, C, h };
}

export function lchToLab(lch: LCh): Lab {
  const rad = (lch.h * Math.PI) / 180;
  return { L: lch.L, a: Math.cos(rad) * lch.C, b: Math.sin(rad) * lch.C };
}

/* ---------- hex ---------- */

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const p = (n: number) => n.toString(16).padStart(2, '0');
  return `#${p(r)}${p(g)}${p(b)}`.toUpperCase();
}

export function hexToLab(hex: string): Lab {
  return rgbToLab(hexToRgb(hex));
}

export function labToHex(lab: Lab): string {
  return rgbToHex(labToRgb(lab));
}

export function hexToLch(hex: string): LCh {
  return labToLch(hexToLab(hex));
}

/* ---------- distancia ---------- */

/** Distancia perceptual entre duas cores em OKLab (~0.02 ja e visivel). */
export function deltaE(a: Lab, b: Lab): number {
  const dL = a.L - b.L;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

/** Menor diferenca entre dois matizes, respeitando a volta do circulo. */
export function hueDistance(h1: number, h2: number): number {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
}

/** Media circular de matizes (graus), opcionalmente com pesos. */
export function meanHue(hues: number[], weights?: number[]): number {
  let x = 0;
  let y = 0;
  hues.forEach((h, i) => {
    const w = weights ? weights[i] : 1;
    const rad = (h * Math.PI) / 180;
    x += Math.cos(rad) * w;
    y += Math.sin(rad) * w;
  });
  let h = (Math.atan2(y, x) * 180) / Math.PI;
  if (h < 0) h += 360;
  return h;
}

/* ---------- utilidades de interface ---------- */

/** Preto ou branco — o que tiver mais contraste sobre a cor dada. */
export function readableOn(hex: string): string {
  const { L } = hexToLch(hex);
  return L > 0.62 ? '#12100E' : '#FFFFFF';
}

/** Versao mais clara/escura da mesma cor, para bordas e realces. */
export function shiftL(hex: string, delta: number): string {
  const lch = hexToLch(hex);
  return labToHex(lchToLab({ ...lch, L: Math.max(0, Math.min(1, lch.L + delta)) }));
}
