import { iconSvg } from './icons.ts';

/** An icon at a size in pixels, or with no size so that CSS sizes it (`className`). */
export function Icon({ name, size = 24, className }: { name: string; size?: number | null; className?: string }) {
  const svg = iconSvg(name);
  if (!svg) return null;
  return (
    <span
      className={className ? `icon ${className}` : 'icon'}
      style={size === null ? undefined : { width: size, height: size }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
