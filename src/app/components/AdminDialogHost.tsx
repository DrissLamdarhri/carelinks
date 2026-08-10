import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { subscribeAdminDialog, closeAdminDialog, type AdminDialogState } from "../../lib/admin-dialog";

// Styled replacement for the admin panel's native confirm()/window.prompt()
// calls — same visual language (shadcn AlertDialog/Dialog, already used
// nowhere else in this codebase until now) instead of the browser's bare
// "localhost:5173 says..." dialog. Mounted once in AdminPanel.tsx.
export function AdminDialogHost() {
  const [state, setState] = useState<AdminDialogState>(null);
  const [value, setValue] = useState("");

  useEffect(() => subscribeAdminDialog(setState), []);

  useEffect(() => {
    if (state?.kind === "prompt") setValue(state.options.defaultValue ?? "");
  }, [state]);

  if (!state) return null;

  if (state.kind === "confirm") {
    const { title, description, confirmText = "Confirmer", cancelText = "Annuler", destructive } = state.options;
    return (
      <AlertDialog open onOpenChange={(open) => { if (!open) { state.resolve(false); closeAdminDialog(); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { state.resolve(false); closeAdminDialog(); }}>
              {cancelText}
            </AlertDialogCancel>
            <AlertDialogAction
              className={destructive ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
              onClick={() => { state.resolve(true); closeAdminDialog(); }}
            >
              {confirmText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  const { title, description, placeholder, confirmText = "Confirmer", cancelText = "Annuler" } = state.options;
  const cancel = () => { state.resolve(null); closeAdminDialog(); };
  const confirm = () => { state.resolve(value); closeAdminDialog(); };
  return (
    <Dialog open onOpenChange={(open) => { if (!open) cancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoFocus
          rows={3}
        />
        <DialogFooter>
          <Button variant="outline" onClick={cancel}>{cancelText}</Button>
          <Button onClick={confirm}>{confirmText}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
