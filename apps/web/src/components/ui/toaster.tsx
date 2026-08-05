'use client';

import { useEffect } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { useToastStore, type ToastMessage, type ToastTone } from '@/lib/stores/toast-store';
import { cn } from '@/lib/utils';

const TONE_ICON: Record<ToastTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const TONE_CLASSES: Record<ToastTone, string> = {
  success: 'text-status-positive',
  error: 'text-status-critical',
  info: 'text-status-info',
};

const AUTO_DISMISS_MS = 5_500;

function ToastItem({ toast }: { toast: ToastMessage }) {
  const dismiss = useToastStore((state) => state.dismiss);
  const Icon = TONE_ICON[toast.tone];

  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast.id, dismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex w-80 animate-toast-in items-start gap-3 rounded-md bg-surface-raised p-3 shadow-elevation-2"
    >
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', TONE_CLASSES[toast.tone])} aria-hidden="true" strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <p className="text-body-sm font-semibold text-primary">{toast.title}</p>
        {toast.description && <p className="mt-0.5 text-body-sm text-secondary">{toast.description}</p>}
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => dismiss(toast.id)}
        className="shrink-0 rounded-sm p-0.5 text-secondary hover:bg-background-subtle"
      >
        <X className="h-4 w-4" aria-hidden="true" strokeWidth={1.75} />
      </button>
    </div>
  );
}

/** Corner-positioned, stacks vertically (docs/design-system/07-component-library.md Toast).
 * Mounted once in the app shell (components/shell/app-shell.tsx). */
export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} />
        </div>
      ))}
    </div>
  );
}
