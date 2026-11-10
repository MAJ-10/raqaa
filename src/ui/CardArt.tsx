import bridge from '../../assets/cards/bridge.svg';
import crane from '../../assets/cards/crane.svg';
import fence from '../../assets/cards/fence.svg';
import inspector from '../../assets/cards/inspector.svg';
import plan from '../../assets/cards/plan.svg';
import type { Card } from '../engine/types.ts';

const ART: Record<Card, string> = { bridge, crane, fence, inspector, plan };

/** An action card's picture from the identity, in the card's ink frame. CSS gives it its size. */
export function CardArt({ card }: { card: Card }) {
  return <img className="card-art" src={ART[card]} alt="" draggable={false} />;
}
