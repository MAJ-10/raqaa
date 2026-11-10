import type { ButtonHTMLAttributes } from 'react';
import { Icon } from './Icon.tsx';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** One primary button at a time; secondary has a line; quiet is for tools around the work. */
  variant?: 'primary' | 'secondary' | 'quiet';
  /** A name from assets/icons, shown before the label. */
  icon?: string;
};

export function Button({ variant = 'secondary', icon, className, children, ...rest }: ButtonProps) {
  return (
    <button type="button" className={['button', `button-${variant}`, className].filter(Boolean).join(' ')} {...rest}>
      {icon ? <Icon name={icon} size={20} /> : null}
      {children ? <span>{children}</span> : null}
    </button>
  );
}
