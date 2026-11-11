import { Component, type ReactNode } from 'react';
import logo from '../../assets/brand/logo.svg';
import { Button } from './Button.tsx';

/**
 * If a screen breaks, this shows instead of a blank page. The competition is saved after every event,
 * so reopening carries on where it was.
 */
export class ErrorScreen extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    console.error('A screen broke', error);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="error-screen">
        <img className="error-logo" src={logo} alt="رقعة" />
        <p className="error-text">صار خطأ في الشاشة. المسابقة محفوظة.</p>
        <Button variant="primary" icon="undo" onClick={() => location.reload()}>
          إعادة فتح
        </Button>
      </main>
    );
  }
}
