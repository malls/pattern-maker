/** Tiny DOM-building helper. Static markup (icons) may use `html`; dynamic
 *  content always goes through text nodes — never innerHTML. */

export interface HProps {
  className?: string;
  text?: string;
  title?: string;
  /** static, trusted markup only (inline SVG icons) */
  html?: string;
  attrs?: Record<string, string>;
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: HProps,
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    if (props.className !== undefined) el.className = props.className;
    if (props.html !== undefined) el.innerHTML = props.html;
    if (props.text !== undefined) el.textContent = props.text;
    if (props.title !== undefined) el.title = props.title;
    if (props.attrs) {
      for (const [k, v] of Object.entries(props.attrs)) el.setAttribute(k, v);
    }
  }
  for (const c of children) {
    el.append(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return el;
}
