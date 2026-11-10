// The iso board's geometry, ported from reference/map9.py (see reference/iso-board.md): one projection,
// rounded boxes with a top and two faces, and flat decals on a roof. Pure functions, no drawing.

export type Point = [number, number];
export type Palette = readonly [top: string, left: string, right: string];

const CO = Math.cos(Math.PI / 4);

/**
 * How the camera looks down on the board: how much the plan is squashed (ce) and how much height shows
 * (se). The reference looks 35° above the ground; a higher camera hides less behind each building.
 */
export type View = { ce: number; se: number };
export const viewFrom = (degreesAboveGround: number): View => {
  const a = (degreesAboveGround * Math.PI) / 180;
  return { ce: Math.sin(a), se: Math.cos(a) };
};
export const REFERENCE_VIEW = viewFrom(35);
/**
 * The display's map, as Mohd chose it so a full map stays readable: the camera 45° above the ground and
 * shorter buildings (0.11 a point of value, not 0.17), so each building hides less of the plot behind it.
 */
export const MAP_VIEW = viewFrom(45);
export const MAP_STEP = 0.11;

/** Gap between plots, plot corner radius, empty plot thickness, height per point of value. */
export const GAP = 0.12;
export const R_TILE = 0.13;
export const TH = 0.16;
export const STEP = 0.17;
/** The plate: margin around the grid, its thickness and corner radius. */
export const MARGIN = 0.32;
export const PLATE_TH = 0.22;
export const PLATE_R = 0.35;

/** Plan coordinates (i to the lower right, j to the lower left, z up) to the screen, centred on the board. */
export function project(i: number, j: number, z: number, s: number, n: number, view: View = REFERENCE_VIEW): Point {
  const a = i - n / 2;
  const b = j - n / 2;
  return [(a - b) * CO * s, (a + b) * CO * view.ce * s - z * view.se * s];
}

/** A rounded rectangle in plan: each corner a quarter circle in five segments, as the reference draws it. */
export function roundedPlan(x0: number, y0: number, x1: number, y1: number, r: number): [number, number][] {
  const corners: [number, number, number][] = [
    [x1 - r, y0 + r, -90],
    [x1 - r, y1 - r, 0],
    [x0 + r, y1 - r, 90],
    [x0 + r, y0 + r, 180],
  ];
  const points: [number, number][] = [];
  for (const [cx, cy, start] of corners) {
    for (let k = 0; k <= 5; k++) {
      const angle = ((start + k * 18) * Math.PI) / 180;
      points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
    }
  }
  return points;
}

/** The convex hull of some points (Andrew's monotone chain), counter-clockwise. */
export function convexHull(points: Point[]): Point[] {
  const sorted = [...points].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  if (sorted.length < 3) return sorted;
  const cross = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (const p of [...sorted].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** The part of a convex polygon on one side of a vertical line (Sutherland–Hodgman on one edge). */
export function clipX(polygon: Point[], x: number, keep: 'left' | 'right'): Point[] {
  const inside = (p: Point) => (keep === 'left' ? p[0] <= x : p[0] >= x);
  const out: Point[] = [];
  polygon.forEach((current, k) => {
    const previous = polygon[(k + polygon.length - 1) % polygon.length]!;
    const crossing = (): Point => {
      const t = (x - previous[0]) / (current[0] - previous[0]);
      return [x, previous[1] + t * (current[1] - previous[1])];
    };
    if (inside(current)) {
      if (!inside(previous)) out.push(crossing());
      out.push(current);
    } else if (inside(previous)) {
      out.push(crossing());
    }
  });
  return out;
}

export const path = (points: Point[]): string =>
  points.length < 3 ? '' : `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`;

export type BoxShape = { left: string; right: string; top: string };

/**
 * A rounded box from z0 to z1: its top, and its two visible faces split at the screen x of the front
 * corner (the left face takes the palette's 2nd colour, the right face its 3rd).
 */
export function box(
  plan: [x0: number, y0: number, x1: number, y1: number],
  z0: number,
  z1: number,
  r: number,
  s: number,
  n: number,
  view: View = REFERENCE_VIEW,
): BoxShape {
  const [x0, y0, x1, y1] = plan;
  const outline = roundedPlan(x0, y0, x1, y1, r);
  const top = outline.map(([i, j]) => project(i, j, z1, s, n, view));
  if (z1 <= z0) return { left: '', right: '', top: path(top) };
  const bottom = outline.map(([i, j]) => project(i, j, z0, s, n, view));
  const hull = convexHull([...top, ...bottom]);
  const front = project(x1, y1, z0, s, n, view)[0];
  return { left: path(clipX(hull, front, 'left')), right: path(clipX(hull, front, 'right')), top: path(top) };
}

/**
 * The matrix that lays a 24-grid icon flat on a roof at plan centre (cx, cy) and height z, `size` plot
 * units wide, upright toward the viewer: its x axis along plan (1, -1) and its y axis along (1, 1).
 */
export function decal(cx: number, cy: number, z: number, size: number, s: number, n: number, view: View = REFERENCE_VIEW): string {
  const k = size / 24;
  const r = 1 / Math.SQRT2;
  const at = (u: number, v: number) =>
    project(cx + (u - 12) * k * r + (v - 12) * k * r, cy - (u - 12) * k * r + (v - 12) * k * r, z, s, n, view);
  const o = at(0, 0);
  const a = at(1, 0);
  const b = at(0, 1);
  const m = [a[0] - o[0], a[1] - o[1], b[0] - o[0], b[1] - o[1], o[0], o[1]];
  return `matrix(${m.map((v) => v.toFixed(4)).join(' ')})`;
}

/** The screen box that holds the whole board: the plate, and the tallest building on it. */
export function bounds(s: number, n: number, view: View = REFERENCE_VIEW, step = STEP): { x: number; y: number; width: number; height: number } {
  const corners: Point[] = [];
  for (const i of [-MARGIN, n + MARGIN]) {
    for (const j of [-MARGIN, n + MARGIN]) {
      for (const z of [-PLATE_TH, TH + 5 * step]) corners.push(project(i, j, z, s, n, view));
    }
  }
  const xs = corners.map((p) => p[0]);
  const ys = corners.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** Pixels per plot: 9×9 at 48, as in the reference; 7×7 larger, so both boards take the same space. */
export const isoUnit = (n: number): number => (48 * (9 + 2 * MARGIN)) / (n + 2 * MARGIN);

/** Where a plot sits in plan: column 1 is at the board's right, row 1 at its top (as on the flat map). */
export function planOf(row: number, col: number, n: number): { i: number; j: number } {
  return { i: n - col, j: row - 1 };
}
