/** Opens the display in its own window, or brings it forward when it's already open. */
export function openDisplayWindow(): void {
  const url = new URL(location.href);
  url.hash = 'display';
  const win = window.open(url.href, 'raqaa-display', 'popup,width=1280,height=720');
  win?.focus();
}
