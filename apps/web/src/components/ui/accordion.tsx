'use client';

import { createContext, useContext, useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type AccordionType = 'single' | 'multiple';

interface AccordionContextValue {
  rootId: string;
  openItems: Set<string>;
  toggle: (value: string) => void;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

function useAccordionContext(caller: string): AccordionContextValue {
  const context = useContext(AccordionContext);
  if (!context) throw new Error(`${caller} must be used within <Accordion>`);
  return context;
}

export interface AccordionProps {
  /** 'single' (default) keeps at most one item open — expanding one collapses any other.
   * 'multiple' allows any number open at once. docs/design-system/07-component-library.md
   * §Accordion. */
  type?: AccordionType;
  defaultOpen?: string[];
  className?: string;
  children: ReactNode;
}

/**
 * docs/design-system/07-component-library.md §Accordion — progressive disclosure for content
 * secondary to a screen's primary purpose. State is uncontrolled and local: no caller in this
 * codebase needs controlled accordion state yet, so a controlled-value API isn't built ahead of
 * that real need.
 */
export function Accordion({ type = 'single', defaultOpen = [], className, children }: AccordionProps) {
  const rootId = useId();
  const [openItems, setOpenItems] = useState<Set<string>>(new Set(defaultOpen));

  const toggle = (value: string) => {
    setOpenItems((current) => {
      const next = new Set(current);
      if (next.has(value)) {
        next.delete(value);
      } else {
        if (type === 'single') next.clear();
        next.add(value);
      }
      return next;
    });
  };

  return (
    <AccordionContext.Provider value={{ rootId, openItems, toggle }}>
      <div className={cn('divide-y divide-border', className)}>{children}</div>
    </AccordionContext.Provider>
  );
}

interface AccordionItemContextValue {
  value: string;
  open: boolean;
  disabled: boolean;
  triggerId: string;
  contentId: string;
}

const AccordionItemContext = createContext<AccordionItemContextValue | null>(null);

function useAccordionItemContext(caller: string): AccordionItemContextValue {
  const context = useContext(AccordionItemContext);
  if (!context) throw new Error(`${caller} must be used within <AccordionItem>`);
  return context;
}

export interface AccordionItemProps {
  value: string;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

export function AccordionItem({ value, disabled = false, className, children }: AccordionItemProps) {
  const { rootId, openItems } = useAccordionContext('AccordionItem');
  const open = openItems.has(value);
  const triggerId = `${rootId}-${value}-trigger`;
  const contentId = `${rootId}-${value}-content`;

  return (
    <AccordionItemContext.Provider value={{ value, open, disabled, triggerId, contentId }}>
      <div className={cn('py-2', className)}>{children}</div>
    </AccordionItemContext.Provider>
  );
}

export function AccordionTrigger({ children, className }: { children: ReactNode; className?: string }) {
  const { toggle } = useAccordionContext('AccordionTrigger');
  const { value, open, disabled, triggerId, contentId } = useAccordionItemContext('AccordionTrigger');

  return (
    <button
      type="button"
      id={triggerId}
      disabled={disabled}
      aria-expanded={open}
      aria-controls={contentId}
      onClick={() => toggle(value)}
      className={cn(
        'flex w-full items-center justify-between gap-2 py-2 text-left text-body-sm text-primary',
        'disabled:cursor-not-allowed disabled:text-disabled',
        className,
      )}
    >
      <span>{children}</span>
      <ChevronDown
        className={cn(
          'h-4 w-4 shrink-0 text-secondary transition-transform duration-base ease-standard',
          open && 'rotate-180',
        )}
        aria-hidden="true"
        strokeWidth={1.75}
      />
    </button>
  );
}

export function AccordionContent({ children, className }: { children: ReactNode; className?: string }) {
  const { open, triggerId, contentId } = useAccordionItemContext('AccordionContent');

  return (
    <div
      className={cn(
        'grid transition-[grid-template-rows] duration-base ease-standard',
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      )}
    >
      <div className="overflow-hidden">
        <div
          id={contentId}
          role="region"
          aria-labelledby={triggerId}
          aria-hidden={!open}
          className={cn('pb-2 pt-1 text-body-sm text-secondary', className)}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
