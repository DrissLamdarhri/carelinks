import { createBrowserRouter, Navigate } from "react-router";
import { AdminPanel } from "./components/AdminPanel";
import { AdminLogin } from "./components/AdminLogin";
import { CarelinePRD } from "./components/CarelinkPRD";
import { RequireAuth } from "./components/RequireAuth";
import { MobileDesignPreview } from "./components/MobileDesignPreview";

// The web app is the CareLink admin dashboard. The patient/pro flows are the
// real product — the mobile app. (The old web "iPhone preview" demo + its KV
// backend have been retired.)
export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/admin" replace /> },
  { path: "/admin", Component: AdminLogin },
  { path: "/admin/dashboard", element: <RequireAuth role="admin"><AdminPanel /></RequireAuth> },
  { path: "/admin/prd", Component: CarelinePRD },
  { path: "/design-preview", Component: MobileDesignPreview },
]);
