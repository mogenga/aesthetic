// oklch.mjs — OKLCH / sRGB conversion, gamut mapping, WCAG contrast.
// Zero dependencies. Node 18+. CommonJS-free ESM.

const D2R = Math.PI / 180;

/** hex string (#rgb / #rrggbb) → [r, g, b] in 0..1 */
export function hexToRgb(hex) {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6 || !/^[0-9a-f]{6}$/i.test(h)) {
    throw new Error(`invalid hex: ${hex}`);
  }
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

/** [r,g,b] 0..1 → #rrggbb */
export function rgbToHex([r, g, b]) {
  const c = (v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

/** [r,g,b] 0..1 (sRGB) → { L, C, H } */
export function rgbToOklch([r, g, b]) {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);

  const l = 0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B;
  const m = 0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B;
  const s = 0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B;

  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);

  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  const C = Math.hypot(a, bb);
  let H = C < 1e-6 ? 0 : (Math.atan2(bb, a) / D2R + 360) % 360;
  return { L, C, H };
}

/** { L, C, H } → [r,g,b] 0..1 (may be out of gamut) */
export function oklchToRgb({ L, C, H }) {
  const hr = H * D2R;
  const a = C * Math.cos(hr);
  const bb = C * Math.sin(hr);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * bb;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * bb;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * bb;

  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;

  const R = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const G = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const B = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  return [linearToSrgb(R), linearToSrgb(G), linearToSrgb(B)];
}

export function inGamut([r, g, b], eps = 1e-4) {
  return [r, g, b].every((v) => v >= -eps && v <= 1 + eps);
}

/**
 * CSS Color 4 gamut mapping: hold L and H, reduce C until in sRGB.
 * Returns { rgb, clipped }.
 */
export function gamutMap({ L, C, H }) {
  const direct = oklchToRgb({ L, C, H });
  if (inGamut(direct)) return { rgb: direct.map(clamp01), clipped: false };

  let lo = 0;
  let hi = C;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToRgb({ L, C: mid, H }))) lo = mid;
    else hi = mid;
  }
  const rgb = oklchToRgb({ L, C: lo, H }).map(clamp01);
  return { rgb, clipped: true, chroma: lo };
}

/** { L, C, H } → #hex, gamut-mapped */
export function oklchToHex(color) {
  const { rgb, clipped } = gamutMap(color);
  return { hex: rgbToHex(rgb), clipped };
}

/** "oklch(0.985 0.002 85)" or "oklch(98.5% 0.002 85 / 0.6)" → { L, C, H, alpha } */
export function parseOklch(str) {
  const m = str.match(
    /oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)/i
  );
  if (!m) throw new Error(`not an oklch() value: ${str}`);
  const L = m[1].endsWith('%') ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
  let alpha = 1;
  if (m[4] != null) alpha = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return { L, C: parseFloat(m[2]), H: parseFloat(m[3]), alpha };
}

export function formatOklch({ L, C, H }, alpha = 1) {
  const f = (v, p = 3) => Number(v.toFixed(p)).toString();
  const base = `oklch(${f(L)} ${f(C)} ${f(H, 1)})`;
  return alpha === 1 ? base : `oklch(${f(L)} ${f(C)} ${f(H, 1)} / ${f(alpha, 2)})`;
}

/** ΔL — the ONLY definition used across this skill: absolute difference of OKLCH L. */
export const deltaL = (a, b) => Math.abs(a.L - b.L);

/** WCAG 2.x relative luminance from sRGB 0..1 */
export function relativeLuminance([r, g, b]) {
  const [R, G, B] = [r, g, b].map(srgbToLinear);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** WCAG contrast ratio, 1..21 */
export function contrastRatio(rgbA, rgbB) {
  const la = relativeLuminance(rgbA);
  const lb = relativeLuminance(rgbB);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function contrastHex(hexA, hexB) {
  return contrastRatio(hexToRgb(hexA), hexToRgb(hexB));
}

/**
 * Build a surface ladder by moving only L.
 * step is hard-clamped to [0.010, 0.030] per R2.
 */
export function surfaceLadder(base, count = 3, step = 0.015) {
  const s = Math.min(0.030, Math.max(0.010, step));
  const out = [{ ...base, level: 0, deltaFromPrev: null }];
  for (let i = 1; i <= count; i++) {
    out.push({ L: base.L - i * s, C: base.C, H: base.H, level: i, deltaFromPrev: s });
  }
  return out;
}

/** Lighten/darken while holding C and H. */
export function shiftL(color, dL) {
  return { ...color, L: Math.min(1, Math.max(0, color.L + dL)) };
}
