// Sync between the referee window, the only writer, and the display windows, which only render what they get.
//
// - A display sends "hello" when it opens or reloads, and the referee answers with a snapshot.
// - After every change the referee sends a snapshot: the full state and the event that caused it.
//
// Messages travel over a BroadcastChannel and, as a fallback, through localStorage and its "storage" event.
// Both work between windows of the website and between windows of the local file (raqaa.html) in Chrome
// and Edge. Every message goes over both, and a display ignores copies it has already seen.
// localStorage also keeps the last snapshot, so a display that opens while the referee window is closed
// still shows the competition as it was left.

export type Snapshot<State, Event> = {
  /** The saved-game format of the state (SCHEMA_VERSION). A display ignores any other version. */
  schema: number;
  /** A new id each time the referee window opens, so a display follows a reopened referee. */
  session: string;
  /** Counts up within a session. A display ignores a snapshot older than the one it shows. */
  seq: number;
  state: State;
  /** The event that made this snapshot, or null when nothing new happened (an answer to "hello", undo). */
  last: Event | null;
  /**
   * The last event in the log, whatever made this snapshot: what the screen shows can depend on it (the
   * answer stays until the first move), so a display that reopens shows the same thing.
   */
  latest: Event | null;
};

export type SyncMessage<State, Event> =
  | { type: 'hello'; id: string }
  | { type: 'snapshot'; snapshot: Snapshot<State, Event> };

export type Transport = 'broadcast' | 'storage';

export interface SyncLink<Message> {
  send(message: Message): void;
  close(): void;
}

const CHANNEL = 'raqaa.sync';
// One localStorage key per message type: raqaa.sync.hello and raqaa.sync.snapshot.
const MAILBOX = 'raqaa.sync.';

/** Both transports by default. "?sync=broadcast" or "?sync=storage" keeps one, so tests can check each alone. */
export function pickTransports(search: string = globalThis.location?.search ?? ''): Transport[] {
  const only = new URLSearchParams(search).get('sync');
  if (only === 'broadcast' || only === 'storage') return [only];
  return typeof BroadcastChannel === 'function' ? ['broadcast', 'storage'] : ['storage'];
}

export function openSyncLink<Message extends { type: string }>(
  onMessage: (message: Message) => void,
  transports: Transport[] = pickTransports(),
): SyncLink<Message> {
  const links = transports.map((t) => (t === 'broadcast' ? broadcastLink(onMessage) : mailboxLink(onMessage)));
  return {
    send: (message) => links.forEach((link) => link.send(message)),
    close: () => links.forEach((link) => link.close()),
  };
}

/** True when a snapshot should replace the one on screen. */
export function isNewer(next: Snapshot<unknown, unknown>, current: Snapshot<unknown, unknown> | null): boolean {
  return current === null || next.session !== current.session || next.seq > current.seq;
}

/** The last snapshot the referee sent, as the "storage" transport left it, if it has this schema; or null. */
export function readLastSnapshot<State, Event>(schema: number): Snapshot<State, Event> | null {
  try {
    const raw = localStorage.getItem(`${MAILBOX}snapshot`);
    const message = raw ? (JSON.parse(raw) as { message: SyncMessage<State, Event> }).message : null;
    return message?.type === 'snapshot' && message.snapshot.schema === schema ? message.snapshot : null;
  } catch {
    return null;
  }
}

export function makeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function broadcastLink<Message>(onMessage: (message: Message) => void): SyncLink<Message> {
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (event: MessageEvent<Message>) => onMessage(event.data);
  return {
    send: (message) => channel.postMessage(message),
    close: () => channel.close(),
  };
}

// The "storage" event fires in every other window of the same origin when a localStorage value changes.
function mailboxLink<Message extends { type: string }>(onMessage: (message: Message) => void): SyncLink<Message> {
  const onStorage = (event: StorageEvent) => {
    if (!event.key?.startsWith(MAILBOX) || event.newValue === null) return;
    try {
      onMessage((JSON.parse(event.newValue) as { message: Message }).message);
    } catch {
      // Not a message from this app; ignore it.
    }
  };
  addEventListener('storage', onStorage);
  return {
    send(message) {
      try {
        // The id makes every write a change, so the event fires even for a repeated message.
        localStorage.setItem(MAILBOX + message.type, JSON.stringify({ id: makeId(), message }));
      } catch (error) {
        console.error('Sync through localStorage failed', error);
      }
    },
    close: () => removeEventListener('storage', onStorage),
  };
}
