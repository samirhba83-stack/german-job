import { create } from 'zustand';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastState {
  toasts: ToastMessage[];
  push: (toast: Omit<ToastMessage, 'id'>) => string;
  dismiss: (id: string) => void;
}

/** docs/design-system/07-component-library.md Toast contract. Global UI state
 * (docs/frontend-architecture/07-state-management-strategy.md ADR-002) — holds transient UI
 * messages only, never server/domain data. Auto-dismiss timing (minimum 5s per docs/frontend-
 * architecture/05-component-architecture.md) is applied by the Toaster viewport, not here, so the
 * store stays a pure, presentation-agnostic message queue. */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

export const toast = {
  success: (title: string, description?: string) => useToastStore.getState().push({ tone: 'success', title, description }),
  error: (title: string, description?: string) => useToastStore.getState().push({ tone: 'error', title, description }),
  info: (title: string, description?: string) => useToastStore.getState().push({ tone: 'info', title, description }),
};
