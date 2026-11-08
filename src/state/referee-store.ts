import { saveGame } from './persist.ts';
import { makeId, openSyncLink, type Snapshot, type SyncLink, type SyncMessage, type Transport } from './sync.ts';

export type Reducer<State, Event> = (state: State, event: Event) => State;

export type RefereeView<State, Event> = {
  readonly state: State;
  readonly events: readonly Event[];
};

export type RefereeStoreOptions<Setup, State, Event> = {
  setup: Setup;
  initial: State;
  reduce: Reducer<State, Event>;
  /** Events of a saved competition to resume. */
  events?: readonly Event[];
  storage?: Storage;
  transports?: Transport[];
};

/**
 * The referee window's store, and the only writer. The state is a pure fold of the events over the
 * initial state, so undo removes the last event and folds again. After every change the store saves
 * the setup and the events, and sends a snapshot to the display windows.
 */
export class RefereeStore<Setup, State, Event> {
  readonly setup: Setup;
  private readonly initial: State;
  private readonly reduce: Reducer<State, Event>;
  private readonly storage: Storage | undefined;
  private readonly link: SyncLink<SyncMessage<State, Event>>;
  private readonly session = makeId();
  private readonly listeners = new Set<() => void>();
  private readonly answered = new Set<string>();
  private view: RefereeView<State, Event>;
  private seq = 0;

  constructor(options: RefereeStoreOptions<Setup, State, Event>) {
    this.setup = options.setup;
    this.initial = options.initial;
    this.reduce = options.reduce;
    this.storage = options.storage;
    const events = [...(options.events ?? [])];
    this.view = { state: events.reduce(this.reduce, this.initial), events };
    this.link = openSyncLink<SyncMessage<State, Event>>((message) => this.receive(message), options.transports);
    // Displays that are already open follow the referee as soon as it opens.
    this.publish(null);
  }

  getView = (): RefereeView<State, Event> => this.view;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  dispatch(event: Event): void {
    this.commit({ state: this.reduce(this.view.state, event), events: [...this.view.events, event] }, event);
  }

  undo(): void {
    if (this.view.events.length === 0) return;
    const events = this.view.events.slice(0, -1);
    this.commit({ state: events.reduce(this.reduce, this.initial), events }, null);
  }

  close(): void {
    this.link.close();
    this.listeners.clear();
  }

  private commit(view: RefereeView<State, Event>, last: Event | null): void {
    this.view = view;
    saveGame({ setup: this.setup, events: view.events }, this.storage);
    this.publish(last);
    this.listeners.forEach((listener) => listener());
  }

  private publish(last: Event | null): void {
    const snapshot: Snapshot<State, Event> = { session: this.session, seq: ++this.seq, state: this.view.state, last };
    this.link.send({ type: 'snapshot', snapshot });
  }

  private receive(message: SyncMessage<State, Event>): void {
    // A "hello" arrives once per transport; answer it once.
    if (message.type !== 'hello' || this.answered.has(message.id)) return;
    this.answered.add(message.id);
    this.publish(null);
  }
}
