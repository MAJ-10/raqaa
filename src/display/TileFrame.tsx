/**
 * The frame inside a team's name board, as the identity draws its signs: a dashed line a little in from
 * the edge, in the team's darker tone, its dashes spread evenly all the way round, corners included.
 * It goes inside a team tile, which places it.
 */
export function TileFrame() {
  return (
    <svg className="tile-frame" aria-hidden="true" focusable="false">
      {/* Its length counts as 100, so the same dashes fit any board evenly (see display.css). */}
      <rect width="100%" height="100%" rx="6" pathLength="100" />
    </svg>
  );
}
