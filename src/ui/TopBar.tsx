import type { ReactNode } from 'react';
import logo from '../../assets/brand/logo-horizontal.svg';

/** The bar across the top of the referee screen: the logo, what is on now, and the tools. */
export function TopBar({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <header className="top-bar">
      <img className="top-bar-logo" src={logo} alt="رقعة" />
      <h1 className="top-bar-title">{title}</h1>
      <div className="top-bar-actions">{children}</div>
    </header>
  );
}

/** Tools that sit together in the bar, as one group. */
export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="toolbar" role="group" aria-label="أدوات">
      {children}
    </div>
  );
}
