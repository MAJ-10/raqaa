import { initialState, reduce } from '../engine/reduce.ts';
import type { GameEvent, GameState, Setup } from '../engine/types.ts';
import { clearGame, saveGame, SCHEMA_VERSION, type SavedGame } from './persist.ts';
import { makeId, openSyncLink, type Snapshot, type SyncLink, type SyncMessage, type Transport } from './sync.ts';

/** What the referee window holds: no competition (the intro page), or a competition and its events. */
type RefereeView = {
  readonly state: GameState | null;
  readonly events: readonly GameEvent[];
};

/** What the display receives. A null state means there is no competition. */
export type DisplaySnapshot = Snapshot<GameState | null, GameEvent>;
type Message = SyncMessage<GameState | null, GameEvent>;

type RefereeStoreOptions = {
  saved?: SavedGame<Setup, GameEvent> | null;
  storage?: Storage;
  transports?: Transport[];
};

const MUTED_KEY = 'raqaa.muted';

function readMuted(storage: Storage | undefined): boolean {
  try {
    return (storage ?? localStorage).getItem(MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Folds events over the setup, keeping those that still follow the rules (a newer version may refuse an old one). */
function resume(setup: Setup, saved: readonly GameEvent[]): RefereeView {
  let state = initialState(setup);
  const events: GameEvent[] = [];
  for (const event of saved) {
    try {
      state = reduce(state, event);
      events.push(event);
    } catch (error) {
      console.error('A saved event no longer follows the rules; the competition resumes before it', error);
      break;
    }
  }
  return { state, events };
}

/**
 * The referee window's store, and the only writer. The state is a fold of the events over the setup's
 * initial state, so undo removes the last event and folds again. After every change the store saves
 * the setup and the events, and sends a snapshot to the display windows.
 */
export class RefereeStore {
  private readonly storage: Storage | undefined;
  private readonly link: SyncLink<Message>;
  private readonly session = makeId();
  private readonly listeners = new Set<() => void>();
  private readonly answered = new Set<string>();
  private view: RefereeView;
  private muted: boolean;
  private seq = 0;

  constructor(options: RefereeStoreOptions = {}) {
    this.storage = options.storage;
    this.view = options.saved ? resume(options.saved.setup, options.saved.events) : { state: null, events: [] };
    this.muted = readMuted(this.storage);
    this.link = openSyncLink<Message>((message) => this.receive(message), options.transports);
    // Displays that are already open follow the referee as soon as it opens.
    this.publish(null);
  }

  getView = (): RefereeView => this.view;

  /** Whether the display's sounds are muted. The referee's choice, kept apart from the competition. */
  isMuted = (): boolean => this.muted;

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      (this.storage ?? localStorage).setItem(MUTED_KEY, muted ? '1' : '0');
    } catch {
      // Private windows may refuse storage; the choice still holds while this window is open.
    }
    this.publish(null);
    this.listeners.forEach((listener) => listener());
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** A new competition with this setup. */
  create(setup: Setup): void {
    this.commit({ state: initialState(setup), events: [] }, null);
  }

  /** Changes the setup. Only before the competition starts. */
  updateSetup(setup: Setup): void {
    if (!this.view.state || this.view.events.length > 0) throw new Error('The setup is fixed once the competition starts');
    this.commit({ state: initialState(setup), events: [] }, null);
  }

  /** Applies an event. Throws, and changes nothing, when the event breaks a rule. */
  dispatch(event: GameEvent): void {
    const { state, events } = this.view;
    if (!state) throw new Error('There is no competition');
    this.commit({ state: reduce(state, event), events: [...events, event] }, event);
  }

  undo(): void {
    const { state, events } = this.view;
    if (!state || events.length === 0) return;
    this.commit(resume(state.setup, events.slice(0, -1)), null);
  }

  /** Clears the competition: back to the intro page. */
  end(): void {
    this.commit({ state: null, events: [] }, null);
  }

  close(): void {
    this.link.close();
    this.listeners.clear();
  }

  private commit(view: RefereeView, last: GameEvent | null): void {
    this.view = view;
    if (view.state) saveGame({ setup: view.state.setup, events: view.events }, this.storage);
    else clearGame(this.storage);
    this.publish(last);
    this.listeners.forEach((listener) => listener());
  }

  private publish(last: GameEvent | null): void {
    const snapshot: DisplaySnapshot = {
      schema: SCHEMA_VERSION,
      session: this.session,
      seq: ++this.seq,
      state: this.view.state,
      last,
      latest: this.view.events.at(-1) ?? null,
      muted: this.muted,
    };
    this.link.send({ type: 'snapshot', snapshot });
  }

  private receive(message: Message): void {
    // A "hello" arrives once per transport; answer it once.
    if (message.type !== 'hello' || this.answered.has(message.id)) return;
    this.answered.add(message.id);
    this.publish(null);
  }
}
