import { describe, expect, it, vi } from 'vitest';
import { SCHEMA_VERSION, clearGame, loadGame, saveGame } from '../src/state/persist.ts';
import { memoryStorage } from './helpers.ts';

const setup = { kind: 'demo' };
const events = [
  { type: 'demo/add', amount: 1, at: 1000 },
  { type: 'demo/add', amount: 1, at: 2000 },
];

describe('saving the competition', () => {
  it('saves the setup and the events with the schema version and the time', () => {
    const storage = memoryStorage();
    expect(saveGame({ setup, events }, storage, 5000)).toBe(true);
    expect(JSON.parse(storage.getItem('raqaa.game') ?? '')).toEqual({
      schema: SCHEMA_VERSION,
      savedAt: 5000,
      setup,
      events,
    });
  });

  it('loads what it saved', () => {
    const storage = memoryStorage();
    saveGame({ setup, events }, storage, 5000);
    expect(loadGame(storage)).toEqual({ schema: SCHEMA_VERSION, savedAt: 5000, setup, events });
  });

  it('finds nothing when nothing was saved, or the save is unreadable', () => {
    const storage = memoryStorage();
    expect(loadGame(storage)).toBeNull();
    storage.setItem('raqaa.game', '{not json');
    expect(loadGame(storage)).toBeNull();
    storage.setItem('raqaa.game', JSON.stringify({ schema: SCHEMA_VERSION, setup }));
    expect(loadGame(storage)).toBeNull();
  });

  it('refuses a save from another schema version', () => {
    const storage = memoryStorage();
    storage.setItem('raqaa.game', JSON.stringify({ schema: SCHEMA_VERSION + 1, savedAt: 1, setup, events }));
    expect(loadGame(storage)).toBeNull();
  });

  it('reports a failed save instead of throwing', () => {
    const storage = memoryStorage();
    storage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(saveGame({ setup, events }, storage)).toBe(false);
    log.mockRestore();
  });

  it('clears the save', () => {
    const storage = memoryStorage();
    saveGame({ setup, events }, storage);
    clearGame(storage);
    expect(loadGame(storage)).toBeNull();
  });
});
