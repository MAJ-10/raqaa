import logo from '../../assets/brand/logo-horizontal.svg';
import type { DemoEvent, DemoState } from '../state/demo.ts';
import { formatNumber } from '../ui/number.ts';
import './display.css';
import { Stage } from './Stage.tsx';
import { useRefereeSnapshot } from './use-referee.ts';

// Phase 1: shows the demo counter in place of the real display states (Phase 5).
export function DisplayApp() {
  const snapshot = useRefereeSnapshot<DemoState, DemoEvent>();

  return (
    <Stage>
      <div className="display-demo">
        <img className="display-logo" src={logo} alt="رقعة" />
        {snapshot ? (
          <output className="display-count" data-testid="count">
            {formatNumber(snapshot.state.count)}
          </output>
        ) : null}
      </div>
    </Stage>
  );
}
