// Motion with the Web Animations API. Under prefers-reduced-motion every motion is an instant change,
// so nothing runs at all.

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Ease-out with a long tail: quick to respond, soft to land. */
export const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';

export function animate(element: Element | null, keyframes: Keyframe[], duration: number): void {
  if (!element || reducedMotion()) return;
  element.animate(keyframes, { duration, easing: EASE_OUT });
}
