// Small DOM helpers. Everything user-supplied goes in as text, never as HTML,
// so spreadsheet content can never inject markup.

type Attrs = Record<string, string | number | boolean | undefined>;

/** Create an element with attributes and children in one call. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key === 'class') node.className = String(value);
    else if (key === 'text') node.textContent = String(value);
    else if (key === 'html') node.innerHTML = String(value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) {
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

/** Append text, turning newlines into `<br>` so sheet line breaks survive. */
export function appendTextWithBreaks(target: Node, value: string): void {
  if (!value) return;
  const parts = String(value).split(/\r\n|\n|\r/);
  parts.forEach((part, i) => {
    target.appendChild(document.createTextNode(part));
    if (i < parts.length - 1) target.appendChild(document.createElement('br'));
  });
}

/** Build an inline SVG from a path `d` list. Paths are build-time constants. */
export function svgIcon(paths: string[], size = 24): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('xmlns', NS);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of paths) {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }
  return svg;
}
