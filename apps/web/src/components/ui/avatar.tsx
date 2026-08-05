import { cn } from '@/lib/utils';

export interface AvatarProps {
  name: string;
  id: string;
  imageUrl?: string | null;
  shape?: 'circular' | 'rounded-square';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES = { sm: 'h-6 w-6 text-caption', md: 'h-8 w-8 text-body-sm', lg: 'h-12 w-12 text-body' } as const;

/** docs/design-system/07-component-library.md — deterministic fallback color derived from the
 * entity's own id (never random per render, so the same entity always gets the same color). */
function fallbackHue(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}

export function Avatar({ name, id, imageUrl, shape = 'circular', size = 'md', className }: AvatarProps) {
  const shapeClass = shape === 'circular' ? 'rounded-full' : 'rounded-md';

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatar sources are arbitrary remote URLs (company logos, profile photos) not part of the Next.js-optimized asset pipeline
      <img
        src={imageUrl}
        alt={name}
        className={cn('object-cover', shapeClass, SIZE_CLASSES[size], className)}
      />
    );
  }

  const hue = fallbackHue(id);
  return (
    <span
      role="img"
      aria-label={name}
      className={cn('flex items-center justify-center font-semibold', shapeClass, SIZE_CLASSES[size], className)}
      // M27.5 accessibility fix, two real bugs found live via axe-core, not inspection:
      // (1) the previous 55%/45% saturation/lightness produced initials text illegible against
      //     roughly half of the 360 possible hues — as low as 2.26:1 at hue 60 (yellow) against
      //     white, far under the 4.5:1 AA minimum. 45%/30% was verified (1-degree-resolution scan
      //     across the full hue wheel, the real WCAG formula) to clear 4.5:1 against white for
      //     every hue this function can produce — worst case 5.28:1, also at hue 60.
      // (2) the text color was the *theme-relative* `text-inverse` token (white in light mode,
      //     near-black in dark mode, meant to pair with `--color-background-inverse`/`--color-
      //     accent`) — but this background is a fixed-formula HSL fill that doesn't change per
      //     theme at all, so in dark mode the text silently became near-black-on-dark-color,
      //     failing contrast just as badly as (1) did. A literal, non-token white is the correct
      //     pairing here (deliberately, not an oversight — the background itself is already
      //     outside the token system for the same reason).
      style={{ backgroundColor: `hsl(${hue} 45% 30%)`, color: '#ffffff' }}
    >
      {initials(name)}
    </span>
  );
}
