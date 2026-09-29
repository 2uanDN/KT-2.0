import { create } from 'zustand';

export interface ToastData {
  id: string;
  message: string;
  undoFn?: () => Promise<void> | void;
  autoHideMs?: number;
}

interface ToastState {
  activeToast: ToastData | null;
  show: (message: string, options?: { undoFn?: () => Promise<void> | void; autoHideMs?: number }) => void;
  dismiss: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set, get) => ({
  activeToast: null,
  show: (message, options) => {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }

    const toast: ToastData = {
      id: crypto.randomUUID(),
      message,
      undoFn: options?.undoFn,
      autoHideMs: options?.autoHideMs ?? 4000,
    };

    set({ activeToast: toast });

    toastTimer = setTimeout(() => {
      if (get().activeToast?.id === toast.id) {
        set({ activeToast: null });
      }
    }, toast.autoHideMs);
  },
  dismiss: () => {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    set({ activeToast: null });
  },
}));

export const toastStore = {
  show: (message: string, options?: { undoFn?: () => Promise<void> | void; autoHideMs?: number }) => {
    useToastStore.getState().show(message, options);
  },
  dismiss: () => {
    useToastStore.getState().dismiss();
  },
};
