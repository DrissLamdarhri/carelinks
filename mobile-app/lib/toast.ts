// Global, branded toast store. `showToast(msg, type)` works from anywhere
// (components, effects, plain functions). Rendered by <ToastHost/> in the root.

export type ToastType = "success" | "error" | "info";
export type ToastItem = { id: string; message: string; type: ToastType };

type Listener = (items: ToastItem[]) => void;

let items: ToastItem[] = [];
const listeners = new Set<Listener>();
const emit = () => {
  const snapshot = [...items];
  listeners.forEach((l) => l(snapshot));
};

const VALID: ToastType[] = ["success", "error", "info"];

export function showToast(message: string, type: ToastType = "info") {
  if (!message) return;
  const t: ToastType = VALID.includes(type) ? type : "info";
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  items = [...items, { id, message, type: t }].slice(-3); // keep at most 3 stacked
  emit();
  setTimeout(() => {
    items = items.filter((x) => x.id !== id);
    emit();
  }, 3000);
}

export const toastSuccess = (m: string) => showToast(m, "success");
export const toastError = (m: string) => showToast(m, "error");
export const toastInfo = (m: string) => showToast(m, "info");

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener([...items]);
  return () => {
    listeners.delete(listener);
  };
}
