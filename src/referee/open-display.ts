// Opening the display on the TV. Chrome and Edge know the screens a page can use (the Window Management
// API): with a second screen extended beside the laptop, the display window moves onto it and fills
// it, and one click on it there makes it fullscreen. With no second screen it opens as a plain window.

/** A screen as the Window Management API describes it. */
type ScreenDetailed = { availLeft: number; availTop: number; availWidth: number; availHeight: number; isInternal: boolean };
type ScreenDetails = { screens: ScreenDetailed[]; currentScreen: ScreenDetailed };
type WithScreens = { getScreenDetails?: () => Promise<ScreenDetails> };

/** Whether the laptop's screen is extended onto another (false when there is one screen, or a mirrored TV). */
export function screenExtended(): boolean | undefined {
  return (globalThis.screen as (Screen & { isExtended?: boolean }) | undefined)?.isExtended;
}

/** The screen beside the referee's, when there is one and the browser may use it; otherwise null. */
async function otherScreen(): Promise<ScreenDetailed | null> {
  const get = (window as Window & WithScreens).getScreenDetails;
  if (!get || !screenExtended()) return null;
  try {
    const { screens, currentScreen } = await get.call(window);
    const others = screens.filter((s) => s !== currentScreen);
    return others.find((s) => !s.isInternal) ?? others[0] ?? null;
  } catch {
    return null; // the referee said no, or the browser can't: the window stays where it opened
  }
}

let opened = false;
const listeners = new Set<() => void>();

/** Whether the referee opened the display in this window, so a mirrored TV is worth a word. */
export const displayOpened = () => opened;
export function onDisplayOpened(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Opens the display in its own window, or brings it forward when it's already open. The window opens at
 * once, while the click still counts, then moves onto the TV and fills it when there is one.
 */
export function openDisplayWindow(): void {
  const url = new URL(location.href);
  url.hash = 'display';
  const win = window.open(url.href, 'raqaa-display', 'popup,width=1280,height=720');
  win?.focus();
  if (!opened) {
    opened = true;
    listeners.forEach((listener) => listener());
  }
  if (!win) return;
  void otherScreen().then((tv) => {
    if (!tv || win.closed) return;
    win.moveTo(tv.availLeft, tv.availTop);
    win.resizeTo(tv.availWidth, tv.availHeight);
  });
}
