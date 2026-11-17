import type { Span } from './overlay-layout';

const CANDIDATES = 'button, [role="button"], a, svg, img, i';

/**
 * Horizontal spans of the page's own controls sitting over the field's box (the show-password eye, a clear
 * button, a caps-lock badge), so our icon can stand beside them instead of on top. Looks only at the field's
 * nearest ancestors, where such controls live.
 */
export function fieldObstacles(field: HTMLElement): Span[] {
  const box = field.getBoundingClientRect();
  const spans: Span[] = [];
  const seen = new Set<Element>();
  let scope: HTMLElement | null = field.parentElement;
  for (let depth = 0; depth < 3 && scope && scope !== document.body; depth++, scope = scope.parentElement) {
    for (const el of scope.querySelectorAll(CANDIDATES)) {
      if (seen.has(el)) continue;
      seen.add(el);
      if (el === field || el.contains(field) || field.contains(el)) continue;
      // An svg or img inside a control is that control's own icon: the control's span already covers it.
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.width > 80 || r.height > 80) continue;
      const verticalOverlap = r.top < box.bottom && r.bottom > box.top;
      const horizontalOverlap = r.left < box.right && r.right > box.left;
      if (!verticalOverlap || !horizontalOverlap) continue;
      if (getComputedStyle(el).visibility === 'hidden') continue;
      spans.push({ left: r.left, right: r.right });
    }
  }
  return spans;
}
