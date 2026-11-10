import type { ReactNode } from 'react';
import type { Card } from '../../engine/types.ts';
import { CardArt } from '../../ui/CardArt.tsx';

/** A card that asks for a decision first: its picture from the identity, its name, and what happened. */
export function Decision({ card, title, children }: { card: Card; title: string; children: ReactNode }) {
  return (
    <div className="decision">
      <CardArt card={card} />
      <div className="decision-main">
        <h3 className="decision-title">{title}</h3>
        <p className="decision-text">{children}</p>
      </div>
    </div>
  );
}
