// Global store for the yoga class reminder popup — works from anywhere
// (push-tap handler, deep-link handler, a future in-app check) the same way
// `lib/toast.ts` works for toasts. Rendered by <YogaReminderModalHost/> in
// the root layout.

export type YogaReminderPayload = { bookingId: string };

type Listener = (payload: YogaReminderPayload | null) => void;

let current: YogaReminderPayload | null = null;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l(current));

export function showYogaReminderPopup(bookingId: string) {
  if (!bookingId) return;
  current = { bookingId };
  emit();
}

export function hideYogaReminderPopup() {
  current = null;
  emit();
}

export function subscribeYogaReminderPopup(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}
