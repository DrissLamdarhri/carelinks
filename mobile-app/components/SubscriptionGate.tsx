import type { ReactNode } from "react";
import { useSubscription } from "@/lib/hooks/useSubscription";

type SubscriptionGateProps = {
  feature?: string;
  fallback?: ReactNode;
  children: ReactNode;
};

export function SubscriptionGate({ feature, fallback = null, children }: SubscriptionGateProps) {
  const { subscription, hasFeature, loading } = useSubscription();

  if (loading) return fallback;
  if (!subscription) return fallback;
  if (feature && !hasFeature(feature)) return fallback;

  return children;
}
