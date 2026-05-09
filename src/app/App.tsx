import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "../lib/auth-context";
import { I18nProvider } from "../lib/i18n";
import { Toaster } from "sonner";

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster position="top-center" richColors />
      </AuthProvider>
    </I18nProvider>
  );
}
