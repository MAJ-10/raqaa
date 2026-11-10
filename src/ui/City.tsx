import type { CSSProperties } from 'react';

// The identity's city: the skyline and the clouds behind the display's map (screen D01), in the
// coordinates of its 1280-wide stage. The referee's map stands on the same city.

/** Buildings: [x, y, width, height], with rounded tops. */
const BLOCKS = [
  [-10, 646, 42, 78], [36, 647, 66, 77], [106, 660, 50, 64], [160, 607, 34, 117], [202, 684, 50, 40], [260, 632, 42, 92],
  [302, 679, 34, 45], [344, 602, 66, 122], [418, 654, 66, 70], [488, 598, 74, 126], [562, 679, 50, 45], [616, 672, 66, 52],
  [682, 663, 34, 61], [724, 610, 58, 114], [786, 653, 58, 71], [848, 617, 42, 107], [894, 670, 66, 54], [968, 679, 74, 45],
  [1042, 647, 50, 77], [1096, 634, 50, 90], [1146, 599, 50, 125], [1200, 634, 34, 90], [1234, 599, 42, 125], [1276, 595, 34, 129],
] as const;

/** Masts on the roofs: [x, y], 3 wide and 22 high. */
const MASTS = [[9.5, 624], [647.5, 650], [751.5, 588], [813.5, 631], [867.5, 595]] as const;

/** Windows: [x, y], 6 by 8. */
const WINDOWS = [
  [-1, 658], [-1, 676], [-1, 694], [77, 659], [45, 677], [61, 677], [77, 677], [45, 695], [61, 695], [115, 672],
  [131, 672], [169, 619], [169, 637], [169, 655], [169, 673], [169, 691], [269, 644], [269, 662], [269, 680], [269, 698],
  [311, 691], [353, 614], [369, 614], [353, 632], [369, 632], [385, 632], [369, 650], [385, 650], [369, 668], [369, 686],
  [385, 686], [427, 666], [459, 666], [427, 684], [443, 684], [459, 684], [513, 610], [529, 610], [529, 628], [497, 664],
  [513, 664], [529, 664], [497, 682], [513, 682], [571, 691], [587, 691], [625, 684], [641, 684], [733, 622], [733, 640],
  [749, 640], [749, 658], [749, 676], [733, 694], [749, 694], [811, 665], [795, 683], [811, 683], [857, 629], [857, 647],
  [857, 683], [919, 682], [977, 691], [993, 691], [1009, 691], [1051, 695], [1121, 646], [1121, 682], [1171, 629], [1155, 647],
  [1171, 647], [1155, 665], [1155, 683], [1171, 683], [1285, 625], [1285, 679], [1285, 697],
] as const;

/** The skyline, as wide as its box; CSS places it. */
export function Skyline({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 588 1280 132" aria-hidden="true" focusable="false">
      <g fill="var(--city)">
        {BLOCKS.map(([x, y, w, h]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx={4} />
        ))}
        {MASTS.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={3} height={22} />
        ))}
      </g>
      <g fill="var(--city-window)">
        {WINDOWS.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={6} height={8} rx={1.5} />
        ))}
      </g>
    </svg>
  );
}

/** One of the identity's clouds: four rounds on a rounded base. CSS (or a style) gives it its width and place. */
export function Cloud({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="-33 -27 89 46" aria-hidden="true" focusable="false">
      <g fill="var(--white)">
        <circle cx={0} cy={0} r={23} />
        <circle cx={22} cy={-8} r={19} />
        <circle cx={41} cy={2} r={15} />
        <circle cx={-19} cy={4} r={14} />
        <rect x={-33} y={2} width={88} height={17} rx={8.5} />
      </g>
    </svg>
  );
}
