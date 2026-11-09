// R12: the log. Every event in words, with its day and the team it concerns.
import type { GameEvent, GameState, Team } from '../../engine/types.ts';
import { CARD_NAMES, CHALLENGE_NAMES, countOf, DAY_NOUN, plotName } from '../../ui/names.ts';

export type LogEntry = { day: number; team: Team | null; text: string };

/** The log, newest first. Auction numbers follow the order of declaration, as in the state. */
export function logEntries(events: readonly GameEvent[], state: GameState): LogEntry[] {
  const name = (team: Team) => state.setup.teams[team].name;
  const entries: LogEntry[] = [];
  let day = 0;
  for (const e of events) {
    if (e.type === 'game/start' || e.type === 'day/end' || e.type === 'days/extend') day += 1;
    const add = (team: Team | null, text: string) => entries.push({ day, team, text });
    const auction = 'auction' in e ? state.auctions[e.auction] : undefined;
    switch (e.type) {
      case 'game/start':
        add(null, 'بدأت المسابقة');
        break;
      case 'numbers/show':
        add(null, 'عرض الأرقام');
        break;
      case 'question/show':
        add(null, 'عرض السؤال');
        break;
      case 'question/outside':
        add(null, 'سؤال من خارج الملف');
        break;
      case 'question/replace':
        add(null, 'تبديل السؤال');
        break;
      case 'answer/show':
        add(null, 'عرض الإجابة');
        break;
      case 'timer/end':
        add(null, 'انتهى المؤقت');
        break;
      case 'timer/restart':
        add(null, 'بدأ المؤقت من أوله');
        break;
      case 'permits/set':
        add(null, e.teams.length > 0 ? `التصاريح: ${e.teams.map(name).join('، ')}` : 'بدون تصاريح');
        break;
      case 'build':
        add(e.team, `${name(e.team)} بنى ${plotName(e.plot)}${e.via === 'bridge' ? ' بالجسر' : ''}`);
        break;
      case 'auction/declare':
        add(e.team, `${name(e.team)} يزايد على ${plotName(e.plot)}`);
        break;
      case 'card/fence':
        if (auction) add(auction.defender, `${name(auction.defender)} استخدم ${CARD_NAMES.fence}`);
        break;
      case 'fence/skip':
        if (auction) add(auction.defender, `${name(auction.defender)} ما استخدم ${CARD_NAMES.fence}`);
        break;
      case 'card/crane':
        add(e.team, `${name(e.team)} استخدم ${CARD_NAMES.crane}`);
        break;
      case 'card/plan':
        add(e.team, `${name(e.team)} وضع ${CARD_NAMES.plan} على ${e.plots.map(plotName).join(' و')}`);
        break;
      case 'card/inspector':
        add(e.team, `${name(e.team)} استخدم ${CARD_NAMES.inspector} على ${name(e.target)}`);
        break;
      case 'turn/pass':
        add(e.team, `${name(e.team)} مرّر الدور`);
        break;
      case 'auction/open':
        if (auction) add(auction.bidder, `فتح مزاد ${name(auction.bidder)} على ${name(auction.defender)}`);
        break;
      case 'challenge/start':
        add(null, `التحدي: ${CHALLENGE_NAMES[e.content.type]}`);
        break;
      case 'challenge/replay':
        add(null, 'تعادل، والتحدي ينعاد');
        break;
      case 'challenge/result':
        add(e.winner, `${name(e.winner)} فاز بالتحدي`);
        break;
      case 'plan/take':
        add(e.team, `${name(e.team)} أخذ ${plotName(e.plot)} بـ${CARD_NAMES.plan}`);
        break;
      case 'day/end':
        add(null, 'بدأ يوم جديد');
        break;
      case 'days/extend':
        add(null, `تمديد ${countOf(e.count, DAY_NOUN)}`);
        break;
      case 'game/end':
        add(null, 'انتهت المسابقة');
        break;
      case 'announce/next':
        add(null, 'الإعلان: التالي');
        break;
    }
  }
  return entries.reverse();
}

/** The events of the current day: everything since the day started. */
export function todaysEvents(events: readonly GameEvent[]): GameEvent[] {
  let start = 0;
  events.forEach((e, i) => {
    if (e.type === 'game/start' || e.type === 'day/end' || e.type === 'days/extend') start = i + 1;
  });
  return events.slice(start);
}
