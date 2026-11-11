import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import logoNight from '../../assets/brand/logo-horizontal-night.svg';
import logo from '../../assets/brand/logo-horizontal.svg';
import '../display/podium.css';
import { Podium } from '../display/Podium.tsx';
import { MISSION_LEVEL } from '../engine/missions.ts';
import { MISSIONS, TEAMS, type Card, type GameState } from '../engine/types.ts';
import { CardArt } from '../ui/CardArt.tsx';
import { Cloud, Skyline, Stars } from '../ui/City.tsx';
import { Icon } from '../ui/Icon.tsx';
import { MedadFoot } from '../ui/MedadFoot.tsx';
import { MissionArt } from '../ui/MissionArt.tsx';
import { motion, reducedMotion } from '../ui/motion.ts';
import { CARD_NAMES, LEVEL_NAMES, MISSION_NAMES } from '../ui/names.ts';
import { LandingMap } from './LandingMap.tsx';
import { MiniStage } from './MiniStage.tsx';
import { landingStory } from './story.ts';
import './landing.css';
import './landing-cards.css';

type Props = { onCreate: () => void; onDemo: () => void };

const clamp = (x: number) => Math.min(1, Math.max(0, x));

/** Runs `update` once now, then with every scroll and resize, at most once a frame. */
function onScroll(update: () => void): () => void {
  let raf = 0;
  const run = () => {
    raf = 0;
    update();
  };
  const later = () => {
    if (!raf) raf = requestAnimationFrame(run);
  };
  later();
  addEventListener('scroll', later, { passive: true });
  addEventListener('resize', later);
  return () => {
    removeEventListener('scroll', later);
    removeEventListener('resize', later);
    cancelAnimationFrame(raf);
  };
}

/** The back of every card, as the identity draws it: a small map in the teams' colours, the tower white. */
const BACK = [
  ['blue', 'blue', 'night-city', 'coral', 'coral'],
  ['blue', 'night-city', 'night-city', 'night-city', 'coral'],
  ['night-city', 'night-city', 'white', 'night-city', 'night-city'],
  ['gold', 'night-city', 'night-city', 'night-city', 'green'],
  ['gold', 'gold', 'night-city', 'green', 'green'],
].flat();

function CardBack() {
  return (
    <span className="land-back-map" aria-hidden="true">
      {BACK.map((colour, i) => (
        <i key={i} style={{ background: `var(--${colour})` }} />
      ))}
    </span>
  );
}

/** The sky's clouds over the top of the page: where each starts across (%), how high (%), and how wide (px). */
const CLOUDS: [number, number, number][] = [
  [-3, 4, 150],
  [30, 5, 96],
  [47, 20, 128],
  [86, 8, 136],
  [93, 46, 110],
  [-2, 68, 118],
];

/**
 * How far the box's open fan reaches from its middle, at full size (px): beside the words, toward the
 * window's edge and toward the words; and on a phone, to either side.
 */
const FAN = { edge: 352, words: 310, phone: 238 };

/**
 * The game's box: its lid, with the logo and the cards' back, and cards under it. As the page scrolls
 * the box opens (`--open`, from 0 to 1 over half a window of scroll, from when the box stands well in
 * view): the lid tilts, the cards fan out from under it, and the box lingers a little as it goes. The
 * box is sized (`--k`) to the room it has, so that its cards, even fanned out, are whole and keep clear
 * of the window's edges; beside the words they may reach a little past its column.
 */
function GameBox() {
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = box.current;
    if (!node) return;
    const fit = () => {
      const { left, width } = node.getBoundingClientRect();
      const middle = left + width / 2;
      const edge = Math.min(middle, innerWidth - middle) - 16;
      const k = matchMedia('(max-width: 759px)').matches ? Math.min(0.9, edge / FAN.phone) : Math.min(1, edge / FAN.edge, (width / 2 + 64) / FAN.words);
      node.style.setProperty('--k', Math.max(0.5, k).toFixed(3));
    };
    fit();
    addEventListener('resize', fit);
    motion(node.querySelector('.land-lid'), [{ opacity: 0, transform: 'translateY(48px) rotate(-6deg)' }, { opacity: 1, transform: 'none' }], { duration: 900, delay: 120, fill: 'backwards' });
    node.querySelectorAll('.land-peek').forEach((card, i) => {
      motion(card, [{ opacity: 0, transform: 'translateY(60px) scale(0.9)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 750 + i * 160, fill: 'backwards' });
    });
    return () => removeEventListener('resize', fit);
  }, []);
  useEffect(() => {
    const node = box.current;
    if (!node || reducedMotion()) return;
    return onScroll(() => {
      let top = 0;
      for (let part: HTMLElement | null = node; part; part = part.offsetParent as HTMLElement | null) top += part.offsetTop;
      const from = Math.max(0, top + node.offsetHeight / 2 - innerHeight * 0.62);
      node.style.setProperty('--open', clamp((scrollY - from) / (innerHeight * 0.5)).toFixed(3));
    });
  }, []);
  return (
    <div ref={box} className="land-box" aria-hidden="true">
      <div className="land-peek land-face land-face-back">
        <CardBack />
      </div>
      <div className="land-peek land-face">
        <CardArt card="bridge" />
        <span className="land-face-name">{CARD_NAMES.bridge}</span>
      </div>
      <div className="land-peek land-face">
        <CardArt card="crane" />
        <span className="land-face-name">{CARD_NAMES.crane}</span>
      </div>
      <div className="land-lid">
        <img src={logoNight} alt="" />
        <CardBack />
        <span>ابنِ مدينتك وتصدّر الرقعة</span>
      </div>
    </div>
  );
}

/** How each card lies on the page, in degrees: a little off straight, each its own way. */
const TILTS = [-2.6, 1.7, -1.1, 2.4, -1.9, 1.4, -2.2, 0.8, 2.1, -1.5, 2.7, -0.9, 1.9, -2.4];

/**
 * A card lying on the page: face down until the page reaches it, then it turns over (and its words show,
 * if it has any); it turns back when the page goes up and leaves it (`data-up`, kept by the page).
 */
function FlipCard({ face, label, order, lie, children }: { face: ReactNode; label: string; order: number; lie: number; children?: ReactNode }) {
  return (
    <figure className="land-card" style={{ '--i': order, '--tilt': `${TILTS[lie % TILTS.length]}deg` } as CSSProperties}>
      <div className="land-flip">
        <div className="land-face">
          {face}
          <span className="land-face-name">{label}</span>
        </div>
        <div className="land-face land-face-back">
          <CardBack />
        </div>
      </div>
      {children ? <figcaption>{children}</figcaption> : null}
    </figure>
  );
}

const CARDS: [Card, string][] = [
  ['fence', 'يلغي مزاداً على أرضك'],
  ['crane', 'حركة إضافية في يومك'],
  ['bridge', 'تبني على بُعد قطعتين'],
  ['plan', 'فخ لمن يزايد على أرضك'],
  ['inspector', 'يكشف لك مشاريع حي آخر'],
];

/** The secret missions by level: the page only names them. */
const LEVELS = (['easy', 'medium', 'hard'] as const).map((level) => ({
  name: LEVEL_NAMES[level],
  missions: MISSIONS.filter((mission) => MISSION_LEVEL[mission] === level),
}));

/** Calls back when the page reaches the element (enough of it is above the bottom of the window), and when it leaves it going back up. */
function watchReached(elements: Iterable<Element>, share: number, changed: (element: Element, reached: boolean) => void): () => void {
  // The window, stretched far above itself: what has gone by stays reached.
  const watch = new IntersectionObserver((entries) => entries.forEach((entry) => changed(entry.target, entry.intersectionRatio >= share)), {
    rootMargin: '100000px 0px -8% 0px',
    threshold: share,
  });
  for (const element of elements) watch.observe(element);
  return () => watch.disconnect();
}

/**
 * The end of the page. «إنشاء غرفة» once more; then night falls with the scroll, as it does on the TV
 * when the announcement starts: it rises from the bottom of the window until it fills it, the stars come
 * out and the city lights (`--dusk`, from 0 to 1 as the podium's part comes up the window). In the night stands «عمدة
 * الرقعة», the display's own podium, for the competition the map above played: its towers are built
 * once, floor by floor, when the page first reaches them. Last, on the city's ground, the maker's
 * signature.
 */
function Ending({ state, onCreate }: { state: GameState; onCreate: () => void }) {
  const end = useRef<HTMLDivElement>(null);
  const create = useRef<HTMLElement>(null);
  const night = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [reached, setReached] = useState(false);

  useEffect(() => {
    const node = end.current;
    const part = night.current;
    if (!node || !part) return;
    return onScroll(() => {
      const box = part.getBoundingClientRect();
      // Night has fallen once the part is well up the window, or nearly all of it shows. It starts when
      // what came before has mostly gone by, and never takes less than a third of a window of scroll.
      const to = Math.max(innerHeight * 0.22, innerHeight - box.height * 0.85);
      const from = Math.max(innerHeight * 0.62, to + innerHeight * 0.3);
      const fallen = clamp((from - box.top) / (from - to));
      const dusk = reducedMotion() ? Math.round(fallen) : fallen;
      node.style.setProperty('--dusk', dusk.toFixed(3));
      // The sky is darker below than above (as the layer's gradient draws it): «إنشاء غرفة» turns its
      // words white once the sky behind them is more night than day.
      const words = create.current?.querySelector('h2')?.getBoundingClientRect();
      const height = words ? clamp((words.top + words.height / 2) / innerHeight) : 0;
      const dark = dusk * dusk + (Math.min(1, dusk * 1.5) - dusk * dusk) * height;
      create.current?.toggleAttribute('data-night', dark >= 0.5);
    });
  }, []);

  useEffect(() => {
    const node = stage.current;
    if (!node || reached) return;
    return watchReached([node], 0.6, (_, now) => {
      if (now) setReached(true);
    });
  }, [reached]);

  return (
    <div ref={end} className="land-ending">
      <div className="land-nightfall" aria-hidden="true">
        <Stars />
      </div>

      <section ref={create} className="land-create">
        <h2>مسابقتك تبدأ من هنا</h2>
        <button type="button" className="land-button land-button-primary" onClick={onCreate}>
          <Icon name="plus" size={22} />
          إنشاء غرفة
        </button>
      </section>

      <footer ref={night} className="land-finale">
        <h2>والفائز صاحب أكثر سكان</h2>
        <div className="land-night">
          <Skyline className="land-night-skyline" />
          <div ref={stage} className="land-podium">
            <MiniStage>{reached ? <Podium state={state} live /> : null}</MiniStage>
          </div>
        </div>
        <MedadFoot night />
      </footer>
    </div>
  );
}

/**
 * The landing page, for whoever opens the site: the game's box over the city; the map, built by the
 * scroll, with what each ring is worth and an auction; the five cards and the nine secret missions, face
 * down until the page reaches them; «إنشاء غرفة»; and the podium at night. It introduces the competition
 * and leaves the details to the rules. The map and the podium tell one short competition, played by
 * the engine (story.ts).
 */
export function Landing({ onCreate, onDemo }: Props) {
  const story = useMemo(() => landingStory(), []);
  const page = useRef<HTMLElement>(null);

  // Every card turns over when the page reaches it, and back when the page leaves it going up.
  useEffect(() => {
    const cards = page.current?.querySelectorAll('.land-card') ?? [];
    return watchReached(cards, 0.6, (card, reached) => card.toggleAttribute('data-up', reached));
  }, []);

  // The screen that follows starts at its top.
  useEffect(
    () => () => {
      scrollTo(0, 0);
    },
    [],
  );

  return (
    <main ref={page} className="landing">
      <header className="land-top">
        <div className="land-city" aria-hidden="true">
          {CLOUDS.map(([x, y, width], i) => (
            <Cloud key={i} className="land-cloud" style={{ insetInlineStart: `${x}%`, top: `${y}%`, width }} />
          ))}
          <Skyline className="land-skyline" />
        </div>
        <div className="land-top-in">
          <div className="land-top-words">
            <img className="land-logo" src={logo} alt="رقعة" />
            <h1>ابنِ مدينتك وتصدّر الرقعة</h1>
            <p>مسابقة حضورية لأربعة أحياء: تبني على الخريطة بالإجابات الصحيحة، وتتنافس على الأرض في المزادات.</p>
            <div className="land-actions">
              <button type="button" className="land-button land-button-primary" onClick={onCreate}>
                <Icon name="plus" size={22} />
                إنشاء غرفة
              </button>
              <button type="button" className="land-button" onClick={onDemo}>
                <Icon name="play" size={22} />
                مسابقة تجريبية
              </button>
            </div>
            <ul className="land-facts">
              <li>
                <Icon name="teams" size={22} />٤ أحياء
              </li>
              <li>
                <Icon name="grid" size={22} />
                خريطة ٩×٩ أو ٧×٧
              </li>
              <li>
                <Icon name="tv" size={22} />
                لابتوب وتلفزيون
              </li>
            </ul>
          </div>
          <GameBox />
        </div>
      </header>

      <LandingMap frames={story.frames} />

      <section className="land-section">
        <div className="land-words">
          <h2>البطاقات</h2>
          <p>على الخريطة بطاقات، يأخذ كل واحدة أول حي يبني على قطعتها.</p>
        </div>
        <div className="land-table">
          {CARDS.map(([card, text], i) => (
            <FlipCard key={card} order={i} lie={i} label={CARD_NAMES[card]} face={<CardArt card={card} />}>
              {text}
            </FlipCard>
          ))}
        </div>
      </section>

      <section className="land-section land-missions">
        <div className="land-words">
          <h2>المشاريع السرية</h2>
          <p>لكل حي مشاريع يختارها قبل البداية، وتُكشف في النهاية: الناجح يزيد السكان، والفاشل ينقصها.</p>
        </div>
        <div className="land-levels">
          {LEVELS.map((level, column) => (
            <div key={level.name} className="land-level">
              <h3>{level.name}</h3>
              {level.missions.map((mission, row) => (
                <FlipCard
                  key={mission}
                  order={column}
                  lie={5 + column * 3 + row}
                  label={MISSION_NAMES[mission]}
                  face={<MissionArt mission={mission} team={TEAMS[(column + row) % TEAMS.length]!} />}
                />
              ))}
            </div>
          ))}
        </div>
      </section>

      <Ending state={story.podium} onCreate={onCreate} />
    </main>
  );
}
