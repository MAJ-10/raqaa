import type { ButtonHTMLAttributes } from 'react';
import { Icon } from './Icon.tsx';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
  /** A name from assets/icons, shown before the label. */
  icon?: string;
};

export function Button({ variant = 'secondary', icon, className, children, ...rest }: ButtonProps) {
  return (
    <button type="button" className={['button', `button-${variant}`, className].filter(Boolean).join(' ')} {...rest}>
      {icon ? <Icon name={icon} /> : null}
      <span>{children}</span>
    </button>
  );
}
