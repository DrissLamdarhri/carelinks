// Global, styled replacements for the browser's native `confirm()` /
// `window.prompt()` — same pub-sub-singleton shape as the mobile app's
// `lib/toast.ts` / `lib/app-alert.ts`, adapted to return a Promise so call
// sites can keep the exact `if (!(await confirmDialog(...))) return;` early-
// return shape the native calls already had. Rendered by a single
// <AdminDialogHost/> mounted once in AdminPanel.tsx.

export type ConfirmDialogOptions = {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

export type PromptDialogOptions = {
  title: string;
  description?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
};

type ConfirmState = { kind: "confirm"; id: string; options: ConfirmDialogOptions; resolve: (v: boolean) => void };
type PromptState = { kind: "prompt"; id: string; options: PromptDialogOptions; resolve: (v: string | null) => void };
export type AdminDialogState = ConfirmState | PromptState | null;

type Listener = (state: AdminDialogState) => void;

let current: AdminDialogState = null;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l(current));

/** Drop-in for `if (!confirm(message)) return;` — styled, awaited. */
export function confirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    current = { kind: "confirm", id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, options, resolve };
    emit();
  });
}

/** Drop-in for `window.prompt(message, defaultValue)` — styled, awaited.
 *  Resolves `null` on cancel, matching native prompt() semantics exactly. */
export function promptDialog(options: PromptDialogOptions): Promise<string | null> {
  return new Promise((resolve) => {
    current = { kind: "prompt", id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, options, resolve };
    emit();
  });
}

export function subscribeAdminDialog(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}

export function closeAdminDialog() {
  current = null;
  emit();
}
