import { getBoard } from '../../engine/board.ts';
import type { GameState, PlotId, Team } from '../../engine/types.ts';
import { Icon } from '../../ui/Icon.tsx';
import { plotName } from '../../ui/names.ts';
import { TeamSymbol } from '../../ui/TeamBadge.tsx';

type Props = {
  state: GameState;
  /** Plots the referee can press now, and whose colour marks them. */
  choices: Set<PlotId>;
  chooser: Team | null;
  /** Plots already picked (placing a plan). */
  picked?: Set<PlotId>;
  onPick: (id: PlotId) => void;
};

/**
 * The flat map on the referee screen. Plots the team in turn can use have a dashed border in its colour;
 * every other plot does nothing. Marks show bases, cards, plans (referee only), declared auctions, and
 * plots built or taken today or yesterday.
 */
export function FlatMap({ state, choices, chooser, picked, onPick }: Props) {
  const board = getBoard(state.setup.size);
  const declared = new Set(state.auctions.filter((a) => a.day === state.day).map((a) => a.plot));

  return (
    <div
      className="flat-map"
      style={{ gridTemplateColumns: `repeat(${board.size}, 1fr)`, ['--chooser' as string]: chooser ? `var(--${chooser})` : undefined }}
    >
      {board.ids.map((id) => {
        const info = board.plots[id]!;
        const plot = state.plots[id]!;
        const fresh = plot.since !== null && plot.since >= state.day - 1;
        const content = (
          <>
            {plot.owner ? <TeamSymbol team={plot.owner} size={26} /> : null}
            {plot.card ? <Icon name={plot.card} size={24} /> : null}
            {info.base ? (
              <span className="plot-mark plot-mark-top">
                <Icon name="hall" size={12} />
              </span>
            ) : null}
            {plot.plan ? (
              <span className="plot-mark plot-mark-top" data-team={plot.plan}>
                <Icon name="plan" size={14} />
              </span>
            ) : null}
            {declared.has(id) ? (
              <span className="plot-mark plot-mark-bottom">
                <Icon name="gavel" size={14} />
              </span>
            ) : null}
            {fresh ? <span className="plot-fresh" /> : null}
          </>
        );
        const props = {
          className: 'plot',
          'data-value': info.value,
          'data-centre': id === board.centre || undefined,
          'data-team': plot.owner ?? undefined,
          'data-plot': id,
        };
        if (choices.has(id)) {
          return (
            <button
              key={id}
              type="button"
              {...props}
              data-choice
              aria-pressed={picked?.has(id) ?? undefined}
              aria-label={`القطعة ${plotName(id)}`}
              onClick={() => onPick(id)}
            >
              {content}
            </button>
          );
        }
        return (
          <div key={id} {...props}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
