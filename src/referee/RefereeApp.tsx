import { useSyncExternalStore } from 'react';
import logo from '../../assets/brand/logo-horizontal.svg';
import { Button } from '../ui/Button.tsx';
import { formatNumber } from '../ui/number.ts';
import { openDisplayWindow } from './open-display.ts';
import './referee.css';
import { getRefereeStore } from './store.ts';

// Phase 1: a demo counter in place of the real referee screens (Phases 3 and 4).
export function RefereeApp() {
  const store = getRefereeStore();
  const { state, events } = useSyncExternalStore(store.subscribe, store.getView);

  return (
    <main className="referee">
      <img className="referee-logo" src={logo} alt="رقعة" />
      <section className="demo">
        <output className="demo-count" data-testid="count">
          {formatNumber(state.count)}
        </output>
        <div className="demo-actions">
          <Button
            variant="primary"
            icon="plus"
            onClick={() => store.dispatch({ type: 'demo/add', amount: 1, at: Date.now() })}
          >
            إضافة
          </Button>
          <Button icon="undo" disabled={events.length === 0} onClick={() => store.undo()}>
            تراجع
          </Button>
        </div>
      </section>
      <Button className="referee-open-display" icon="tv" onClick={openDisplayWindow}>
        فتح شاشة العرض
      </Button>
    </main>
  );
}
