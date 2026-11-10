import { svgByName } from './svg.ts';

// Icons from assets/icons (24 grid, drawn in currentColor), inlined so they take the text colour.
const icons = svgByName(
  import.meta.glob<string>('../../assets/icons/*.svg', { query: '?raw', import: 'default', eager: true }),
);

/** An icon's SVG markup by its file name, for the Icon component and for elements made outside React. */
export const iconSvg = (name: string): string | undefined => icons[name];
