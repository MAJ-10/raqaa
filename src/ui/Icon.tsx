// Icons from assets/icons (24 grid, drawn in currentColor), inlined so they take the text colour.
const files = import.meta.glob<string>('../../assets/icons/*.svg', { query: '?raw', import: 'default', eager: true });

const icons: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, svg]) => [path.slice(path.lastIndexOf('/') + 1, -'.svg'.length), svg]),
);

export function Icon({ name, size = 24 }: { name: string; size?: number }) {
  const svg = icons[name];
  if (!svg) return null;
  return <span className="icon" style={{ width: size, height: size }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
}
