import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import '../display/display.css';
import '../display/motion.css';
import { IsoMap } from '../display/IsoMap.tsx';
import type { GameEvent } from '../engine/types.ts';
import { Icon } from '../ui/Icon.tsx';
import { motion } from '../ui/motion.ts';
import { formatNumber } from '../ui/number.ts';
import { RINGS, type CityFrame, type Ring } from './story.ts';
import './landing-map.css';

/** What the words beside the map say in each part of the story. */
const PARTS: { title: string; text: string }[] = [
  { title: 'أربعة أحياء، وخريطة واحدة', text: 'يبدأ كل حي ببلديته في زاوية.' },
  { title: 'الإجابة الصحيحة تصريح بناء', text: 'كل يوم سؤال، والحي الذي يجيب إجابة صحيحة يبني قطعة بجانب أرضه.' },
  { title: 'كلما قربت من الوسط زاد السكان', text: 'و«برج الرقعة» في الوسط أغلى قطعة.' },
  { title: 'وأرض جارك تأخذها بالمزاد', text: 'يلعب الطرفان تحديات، ومن يفز بتحديين يأخذ القطعة.' },
];

/** The rings from the edge in, as the city grows: its name, and its plots' colour on the map. A plot's population follows its ring. */
const LADDER: { ring: Ring; name: string; swatch: string }[] = [
  { ring: 'base', name: 'البلدية', swatch: 'conic-gradient(var(--coral) 0 25%, var(--blue) 0 50%, var(--gold) 0 75%, var(--green) 0)' },
  { ring: 'outer', name: 'الحلقة الخارجية', swatch: 'var(--plot-2)' },
  { ring: 'second', name: 'الحلقة الثانية', swatch: 'var(--plot-3)' },
  { ring: 'first', name: 'الحلقة الأولى', swatch: 'var(--plot-4)' },
  { ring: 'tower', name: 'برج الرقعة', swatch: 'var(--tower)' },
];

/** Where the scroll is, from 0 to 1, when the first building goes up and when the story has been told. */
const START = 0.06;
const END = 0.9;

const clamp = (x: number) => Math.min(1, Math.max(0, x));

/** How far down the scroll each frame comes: one step a building, and more room for the auction's two. */
function stops(frames: CityFrame[]): number[] {
  const room = (frame: CityFrame) => (frame.part === 3 ? 2.6 : 1);
  const all = frames.slice(1).reduce((sum, frame) => sum + room(frame), 0);
  let before = 0;
  return frames.map((frame, i) => {
    if (i === 0) return 0;
    const at = START + (END - START) * (before / all);
    before += room(frame);
    return at;
  });
}

/** The words of a part of the story, rising in as it comes. */
function Words({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    motion(box.current, [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 600 });
  }, []);
  return (
    <div ref={box} className="land-part">
      {children}
    </div>
  );
}

type View = { frame: number; fresh: GameEvent | null };

/**
 * The city, built by the scroll. The scene holds in the window while its track goes by: each step of the
 * scroll puts up a building (its population rising from it, as on the TV), ring after ring to the tower,
 * then a bid and the plot it wins. Beside the map, a few words, and the rings with what a plot in each
 * is worth, from the base down to the tower, each lighting as the city reaches it (on a phone: the
 * words, the map, then the rings). Scrolling back takes the buildings away again. At the end of the
 * track the scene lets go, and the map goes up with the page.
 */
export function LandingMap({ frames }: { frames: CityFrame[] }) {
  const track = useRef<HTMLDivElement>(null);
  const at = useMemo(() => stops(frames), [frames]);
  const [view, setView] = useState<View>({ frame: 0, fresh: null });

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const box = track.current?.getBoundingClientRect();
      if (!box) return;
      const p = clamp(-box.top / Math.max(1, box.height - innerHeight));
      const frame = at.findLastIndex((stop) => stop <= p);
      setView((old) => {
        if (frame === old.frame) return old;
        // Forward, the new building lands; backward, the city just goes back.
        const move = frame > old.frame ? frames[frame]!.move : null;
        return { frame, fresh: move ? { ...move, at: Date.now() } : null };
      });
    };
    const later = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    later();
    addEventListener('scroll', later, { passive: true });
    addEventListener('resize', later);
    return () => {
      removeEventListener('scroll', later);
      removeEventListener('resize', later);
      cancelAnimationFrame(raf);
    };
  }, [frames, at]);

  const frame = frames[view.frame]!;
  const part = PARTS[frame.part]!;
  const reached = RINGS.indexOf(frame.ring);

  return (
    <section ref={track} className="land-map-track">
      <div className="land-map-scene">
        <div className="land-map-words">
          <Words key={frame.part}>
            <h2>{part.title}</h2>
            <p>{part.text}</p>
          </Words>
        </div>
        <ol className="land-rings">
          {LADDER.map(({ ring, name, swatch }) => {
            const level = RINGS.indexOf(ring);
            return (
              <li key={ring} data-now={level === reached || undefined} data-ahead={level > reached || undefined}>
                <i style={{ background: swatch }} />
                {name}
                <b>
                  <Icon name="house" size={18} />
                  {/* A plot built adds its ring's population; the base is where a team starts. */}
                  <span dir="ltr">{formatNumber((level + 1) * 100, { sign: level > 0 })}</span>
                </b>
              </li>
            );
          })}
        </ol>
        <div className="land-map-box">
          <span className="land-day">اليوم {formatNumber(frame.day)}</span>
          <IsoMap state={frame.state} fresh={view.fresh} className="land-iso" />
        </div>
      </div>
    </section>
  );
}
