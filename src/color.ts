// Color math for scale-driven badges. Pure functions, no DOM, so a config
// editor can call them to preview a scale without rendering a page.

/** Parse `#rgb` or `#rrggbb` into channel values. Returns null on anything else. */
export function parseHex(value: string): [number, number, number] | null {
  const hex = String(value ?? '').trim().replace(/^#/, '');
  if (hex.length === 3) {
    const [r, g, b] = [...hex].map(c => Number.parseInt(c + c, 16));
    return [r, g, b].some(Number.isNaN) ? null : [r!, g!, b!];
  }
  if (hex.length === 6) {
    const parts = [0, 2, 4].map(i => Number.parseInt(hex.slice(i, i + 2), 16));
    return parts.some(Number.isNaN) ? null : [parts[0]!, parts[1]!, parts[2]!];
  }
  return null;
}

function toHex(channels: [number, number, number]): string {
  return '#' + channels.map(c => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('');
}

/**
 * Color at position `t` (0 to 1) along a ramp of hex stops.
 *
 * A continuous score scale needs a color per value, which no operator wants to
 * type out; two or three stops and this function cover 0 to 100 just as well.
 */
export function rampColor(colors: string[], t: number): string {
  const stops = colors.map(parseHex).filter((c): c is [number, number, number] => c !== null);
  if (!stops.length) return '';
  if (stops.length === 1) return toHex(stops[0]!);
  const clamped = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
  const span = clamped * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(span));
  const local = span - index;
  const from = stops[index]!;
  const to = stops[index + 1]!;
  return toHex([
    from[0] + (to[0] - from[0]) * local,
    from[1] + (to[1] - from[1]) * local,
    from[2] + (to[2] - from[2]) * local,
  ]);
}

/**
 * `'#fff'` or `'#111'`, whichever reads better on `background`.
 * Uses the WCAG relative-luminance threshold so operator-picked scale colors
 * never produce an unreadable badge.
 */
export function readableTextColor(background: string): string {
  const rgb = parseHex(background);
  if (!rgb) return '#fff';
  const channel = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
  return luminance > 0.5 ? '#111' : '#fff';
}
