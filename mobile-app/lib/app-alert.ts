// Global, branded alert/confirm store — a drop-in replacement for React
// Native's `Alert.alert(title, message, buttons)`, styled like the rest of
// the app instead of the bare OS dialog. Same pub-sub pattern as
// `lib/toast.ts` (works from anywhere) and rendered once by
// `<AppAlertHost/>` in the root layout.

export type AppAlertButtonStyle = "default" | "cancel" | "destructive";
export type AppAlertButton = {
  text: string;
  onPress?: () => void;
  style?: AppAlertButtonStyle;
};
export type AppAlertItem = {
  id: string;
  title: string;
  message?: string;
  buttons: AppAlertButton[];
};

type Listener = (item: AppAlertItem | null) => void;

let current: AppAlertItem | null = null;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l(current));

/** Same call shape as `Alert.alert` — title, optional message, optional
 *  buttons array. Defaults to a single "OK" button when omitted. */
export function showAppAlert(title: string, message?: string, buttons?: AppAlertButton[]) {
  current = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    message,
    buttons: buttons && buttons.length ? buttons : [{ text: "OK", style: "default" }],
  };
  emit();
}

export function dismissAppAlert() {
  current = null;
  emit();
}

export function subscribeAppAlert(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}
