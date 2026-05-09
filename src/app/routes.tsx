import { createBrowserRouter } from "react-router";
import { MobileShell } from "./components/MobileShell";
import { Onboarding } from "./components/Onboarding";
import { PatientDashboard } from "./components/PatientDashboard";
import { NurseBooking } from "./components/NurseBooking";
import { WaitingOffers } from "./components/WaitingOffers";
import { NurseOffers } from "./components/NurseOffers";
import { ProviderProfile } from "./components/ProviderProfile";
import { LiveTracking } from "./components/LiveTracking";
import { RatingScreen } from "./components/RatingScreen";
import { YogaCatalog } from "./components/YogaCatalog";
import { PsychologistBooking } from "./components/PsychologistBooking";
import { ChatScreen } from "./components/ChatScreen";
import { MyBookings } from "./components/MyBookings";
import { ProfileScreen } from "./components/ProfileScreen";
import { NurseRegistration } from "./components/NurseRegistration";
import { NurseDashboard } from "./components/NurseDashboard";
import { NurseEarnings } from "./components/NurseEarnings";
import { NurseProfile } from "./components/NurseProfile";
import { AdminPanel } from "./components/AdminPanel";
import { AdminLogin } from "./components/AdminLogin";
import { AppLayout } from "./components/AppLayout";
import { NurseLayout } from "./components/NurseLayout";
import { PatientAuth } from "./components/PatientAuth";
import { ProLogin } from "./components/ProLogin";
import { CarelinePRD } from "./components/CarelinkPRD";
import { RequireAuth } from "./components/RequireAuth";
import { MobileDesignPreview } from "./components/MobileDesignPreview";

export const router = createBrowserRouter([
  // ── Mobile routes (wrapped in iPhone frame) ─────────────────────────────
  {
    path: "/",
    Component: MobileShell,
    children: [
      { index: true, Component: Onboarding },

      // Auth
      { path: "auth/patient", Component: PatientAuth },
      { path: "auth/pro", Component: ProLogin },

      // Patient app (protected)
      {
        path: "app",
        element: <RequireAuth role="patient"><AppLayout /></RequireAuth>,
        children: [
          { index: true, Component: PatientDashboard },
          { path: "request", Component: NurseBooking },
          { path: "waiting", Component: WaitingOffers },
          { path: "offers", Component: NurseOffers },
          { path: "provider/:id", Component: ProviderProfile },
          { path: "tracking", Component: LiveTracking },
          { path: "rating", Component: RatingScreen },
          { path: "yoga", Component: YogaCatalog },
          { path: "psychologist", Component: PsychologistBooking },
          { path: "chat", Component: ChatScreen },
          { path: "bookings", Component: MyBookings },
          { path: "profile", Component: ProfileScreen },
        ],
      },

      // Nurse registration (KYC)
      { path: "register", Component: NurseRegistration },

      // Nurse app (protected, after approval)
      {
        path: "nurse",
        element: <RequireAuth role="pro"><NurseLayout /></RequireAuth>,
        children: [
          { index: true, Component: NurseDashboard },
          { path: "schedule", Component: NurseDashboard },
          { path: "earnings", Component: NurseEarnings },
          { path: "profile", Component: NurseProfile },
        ],
      },
    ],
  },

  // ── Admin routes (full desktop, no iPhone frame) ─────────────────────────
  { path: "/admin", Component: AdminLogin },
  { path: "/admin/dashboard", element: <RequireAuth role="admin"><AdminPanel /></RequireAuth> },
  { path: "/admin/prd", Component: CarelinePRD },
  { path: "/design-preview", Component: MobileDesignPreview },
]);