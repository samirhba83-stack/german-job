'use client';

import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface DropdownContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  contentRef: React.RefObject<HTMLDivElement>;
  triggerRef: React.RefObject<HTMLElement>;
}

const DropdownContext = createContext<DropdownContextValue | null>(null);

function useDropdownContext(): DropdownContextValue {
  const ctx = useContext(DropdownContext);
  if (!ctx) throw new Error('DropdownMenu.* must be used inside <DropdownMenu>');
  return ctx;
}

/** Merges this component's own ref with whatever ref (if any) the caller already attached to the
 * trigger element, so neither is silently dropped (Milestone 22.3 audit fix). */
function setRef<T>(ref: React.Ref<T> | null | undefined, value: T | null): void {
  if (typeof ref === 'function') {
    ref(value);
  } else if (ref && typeof ref === 'object') {
    (ref as React.MutableRefObject<T | null>).current = value;
  }
}

export function DropdownMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement>(null);

  return (
    <DropdownContext.Provider value={{ open, setOpen, contentRef, triggerRef }}>
      {/* `div`, not `span`: DropdownMenuContent renders a block-level `role="menu"` div, which is
          not valid content inside a `span` (phrasing content only) — a real, if minor, invalid-HTML
          bug present at every one of this component's call sites, found in Milestone 22.3's audit.
          `inline-block` keeps it a same layout behavior as before. */}
      <div className="relative inline-block">{children}</div>
    </DropdownContext.Provider>
  );
}

/**
 * `asChild`-style trigger (docs/interaction-framework/13-decision-records.md IDR-006): clones the
 * real interactive element passed as `children` and attaches the open/keyboard/aria behavior
 * directly to it, rather than wrapping it in a second `<span role="button">`. Fixes a real,
 * shipped bug (M22.2 self-review): every prior call site (ProfileMenu's Avatar button, Quick
 * Actions' Button, Background Activity Center's button) was nested inside an extra interactive
 * element, producing invalid, double-focusable markup.
 */
export function DropdownMenuTrigger({ children }: { children: ReactElement }) {
  const { open, setOpen, contentRef, triggerRef } = useDropdownContext();
  const child = Children.only(children);
  if (!isValidElement(child)) return children;

  // Preserve any ref the caller already put on this element rather than overwriting it — a real
  // gap in the original asChild implementation (Milestone 22.3 audit).
  const existingRef = (child as unknown as { ref?: React.Ref<HTMLElement> }).ref;

  return cloneElement(child as ReactElement<Record<string, unknown>>, {
    ref: (node: HTMLElement | null) => {
      (triggerRef as React.MutableRefObject<HTMLElement | null>).current = node;
      setRef(existingRef, node);
    },
    onClick: (event: React.MouseEvent) => {
      (child.props as { onClick?: (e: React.MouseEvent) => void }).onClick?.(event);
      setOpen(!open);
    },
    onKeyDown: (event: React.KeyboardEvent) => {
      (child.props as { onKeyDown?: (e: React.KeyboardEvent) => void }).onKeyDown?.(event);
      if (event.key === 'ArrowDown' && !open) {
        event.preventDefault();
        setOpen(true);
        requestAnimationFrame(() => {
          contentRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
        });
      }
    },
    'aria-haspopup': 'menu',
    'aria-expanded': open,
  });
}

export function DropdownMenuContent({ children, align = 'end' }: { children: ReactNode; align?: 'start' | 'end' }) {
  const { open, setOpen, contentRef, triggerRef } = useDropdownContext();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (contentRef.current && !contentRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    // Real APG menu keyboard pattern: Up/Down moves focus between items, Home/End jump to the
    // ends, Escape closes and returns focus to the trigger. This was entirely missing before
    // M22.2's self-review despite the component already claiming role="menu" semantics.
    function onKeyDown(event: KeyboardEvent) {
      if (!contentRef.current) return;
      const items = Array.from(contentRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]'));
      const currentIndex = items.indexOf(document.activeElement as HTMLElement);

      if (event.key === 'Escape') {
        // Milestone 22.3 audit fix: this comment previously described this behavior without the
        // component actually doing it — closing (unmounting) the menu with a focused menuitem
        // inside it drops focus to <body>, silently breaking a keyboard user's position on the
        // page. Restoring focus to the trigger is the real APG-specified behavior.
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        items[(currentIndex + 1) % items.length]?.focus();
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        items[(currentIndex - 1 + items.length) % items.length]?.focus();
      }
      if (event.key === 'Home') {
        event.preventDefault();
        items[0]?.focus();
      }
      if (event.key === 'End') {
        event.preventDefault();
        items[items.length - 1]?.focus();
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    // Real focus management: the first item is focused the moment the menu opens, matching the
    // APG menu pattern — never left unfocused with only a visual "open" indication.
    requestAnimationFrame(() => {
      contentRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    });
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, setOpen, contentRef, triggerRef]);

  if (!open) return null;

  return (
    <div
      ref={contentRef}
      role="menu"
      className={cn(
        'absolute z-40 mt-1.5 min-w-[12rem] origin-top rounded-md bg-surface-raised p-1 shadow-elevation-2',
        'animate-menu-in',
        align === 'end' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
      )}
    >
      {children}
    </div>
  );
}

interface DropdownMenuItemProps {
  children: ReactNode;
  onSelect?: () => void;
  /** Renders as a real, single `<a role="menuitem">` (via next/link) instead of nesting a Link
   * inside a button — fixes a real shipped bug: `<button><a>...</a></button>` is invalid HTML
   * (interactive content inside interactive content) and every ProfileMenu navigation item had it. */
  href?: string;
  destructive?: boolean;
}

export function DropdownMenuItem({ children, onSelect, href, destructive = false }: DropdownMenuItemProps) {
  const { setOpen, triggerRef } = useDropdownContext();
  const className = cn(
    'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-body-sm outline-none',
    'hover:bg-background-subtle focus-visible:bg-background-subtle',
    destructive ? 'text-status-critical' : 'text-primary',
  );

  if (href) {
    // No explicit focus restoration here: activating a real navigation item hands focus to the
    // destination route, which is the correct outcome — forcing focus back to the trigger first
    // would fight that handoff.
    return (
      <Link href={href} role="menuitem" className={className} onClick={() => setOpen(false)}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      role="menuitem"
      className={className}
      onClick={() => {
        onSelect?.();
        setOpen(false);
        // A non-navigating action (log out, retry, theme change) unmounts the menu with nowhere
        // for focus to go otherwise — same fix as Escape, applied here for the same reason
        // (Milestone 22.3 audit).
        triggerRef.current?.focus();
      }}
    >
      {children}
    </button>
  );
}

export function DropdownMenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-border-subtle" />;
}
