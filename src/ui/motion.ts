// Motion with the Web Animations API. Under prefers-reduced-motion every motion is an instant change,
// so nothing runs at all.

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Ease-out with a long tail: quick to respond, soft to land. */
export const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';

/** Overshoots a little and settles: for things that land or pop. */
export const EASE_BOUNCE = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

export function animate(element: Element | null, keyframes: Keyframe[], duration: number): void {
  if (!element || reducedMotion()) return;
  element.animate(keyframes, { duration, easing: EASE_OUT });
}

/** Runs one animation (ease-out unless told otherwise), or nothing under reduced motion. */
export function motion(element: Element | null | undefined, keyframes: Keyframe[], options: KeyframeAnimationOptions): Animation | null {
  if (!element || reducedMotion()) return null;
  return element.animate(keyframes, { easing: EASE_OUT, ...options });
}
