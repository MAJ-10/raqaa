import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CardArt } from '../../ui/CardArt.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { reducedMotion } from '../../ui/motion.ts';
import { BANNER_TIME, type Banner } from './banner.ts';

/** The identity's event banner over the map: ink, with the team's colour, for a short while. */
export function EventBanner({ banner, name }: { banner: Banner; name: string }) {
  const [shown, setShown] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  const picture = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = box.current;
    const still = reducedMotion();
    if (element && !still) {
      element.animate(
        [
          { opacity: 0, transform: 'translate(-50%, -50%) translateY(18px) scale(0.7)' },
          { opacity: 1, transform: 'translate(-50%, -50%) translateY(-4px) scale(1.04)', offset: 0.6 },
          { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
        ],
        { duration: 520, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)' },
      );
      picture.current?.animate(
        [
          { transform: 'rotate(-14deg) scale(0.5)', opacity: 0 },
          { transform: 'rotate(6deg) scale(1.12)', opacity: 1, offset: 0.65 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 620, delay: 120, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)', fill: 'backwards' },
      );
    }
    const left = Math.max(0, banner.at + BANNER_TIME - Date.now());
    const leave = setTimeout(() => {
      if (!element || still) return setShown(false);
      element
        .animate(
          [
            { opacity: 1, transform: 'translate(-50%, -50%)' },
            { opacity: 0, transform: 'translate(-50%, -50%) translateY(-12px) scale(0.96)' },
          ],
          { duration: 260, easing: 'ease-in', fill: 'forwards' },
        )
        .finished.then(() => setShown(false), () => setShown(false));
    }, left - 260);
    return () => clearTimeout(leave);
  }, [banner.at]);

  if (!shown) return null;
  let art: ReactNode = null;
  if (banner.card) art = <CardArt card={banner.card} />;
  else if (banner.icon) art = <Icon name={banner.icon} size={30} />;
  return (
    <div ref={box} className="event-banner" role="status" data-team={banner.team}>
      <span ref={picture} className="event-banner-picture" data-card={banner.card ? true : undefined}>
        {art}
      </span>
      <span className="event-banner-text">
        <span>
          <strong>{name}</strong> {banner.text}
        </span>
        {banner.more ? <span className="event-banner-more">{banner.more}</span> : null}
      </span>
    </div>
  );
}
