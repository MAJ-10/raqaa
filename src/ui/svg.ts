/** Turns an `import.meta.glob` of raw SVG files into a map from file name (without .svg) to its markup. */
export function svgByName(files: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files).map(([path, svg]) => [path.slice(path.lastIndexOf('/') + 1, -'.svg'.length), svg]),
  );
}
