// Sync between the referee window, the only writer, and the display windows, which only render what they get.
//
// - A display sends "hello" when it opens or reloads, and the referee answers with a snapshot.
// - After every change the referee sends a snapshot: the full state and the event that caused it.
//
// Messages travel over a BroadcastChannel and, as a fallback, through localStorage and its "storage" event.
// Both work between windows of the website and between windows of the local file (raqaa.html) in Chrome
// and Edge. Every message goes over both, and a display ignores copies it has already seen.

export type Snapshot<State, Event> = {
  /** A new id each time the referee window opens, so a display follows a reopened referee. */
  session: string;
  /** Counts up within a session. A display ignores a snapshot older than the one it shows. */
  seq: number;
  state: State;
  /** The event that made this snapshot, or null when nothing new happened (an answer to "hello", undo). */
  last: Event | null;
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
const MAILBOX_KEY = 'raqaa.sync';

/** Both transports by default. "?sync=broadcast" or "?sync=storage" keeps one, so tests can check each alone. */
export function pickTransports(search: string = globalThis.location?.search ?? ''): Transport[] {
  const only = new URLSearchParams(search).get('sync');
  if (only === 'broadcast' || only === 'storage') return [only];
  return typeof BroadcastChannel === 'function' ? ['broadcast', 'storage'] : ['storage'];
}

export function openSyncLink<Message>(
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
function mailboxLink<Message>(onMessage: (message: Message) => void): SyncLink<Message> {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== MAILBOX_KEY || event.newValue === null) return;
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
        localStorage.setItem(MAILBOX_KEY, JSON.stringify({ id: makeId(), message }));
      } catch (error) {
        console.error('Sync through localStorage failed', error);
      }
    },
    close: () => removeEventListener('storage', onStorage),
  };
}
