import type { ReactNode } from "react";
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db/dal";
import type { Subscription } from "@/lib/db/types";
import { supabase } from "@/lib/supabase";

type SubscriptionEventPayload = {
  type: "SUBSCRIPTION_UPDATED" | "SUBSCRIPTION_ROLLBACK";
  payload: {
    plan: string;
    features: string[];
    expiresAt: string | null;
  };
};

type SubscriptionContextValue = {
  subscription: Subscription | null;
  loading: boolean;
  error: string | null;
  hasFeature: (feature: string) => boolean;
  refresh: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextValue>({
  subscription: null,
  loading: false,
  error: null,
  hasFeature: () => false,
  refresh: async () => {},
});

function buildSubscriptionSnapshot(
  userId: string,
  payload: SubscriptionEventPayload["payload"],
  previous: Subscription | null,
): Subscription {
  const now = new Date().toISOString();
  return {
    user_id: userId,
    plan_id: payload.plan,
    status: previous?.status ?? "active",
    expires_at: payload.expiresAt,
    features: payload.features,
    created_at: previous?.created_at ?? now,
    updated_at: now,
  };
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [featureSet, setFeatureSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<Subscription | null>(null);

  useEffect(() => {
    subscriptionRef.current = subscription;
  }, [subscription]);

  const applySubscription = useCallback((next: Subscription | null) => {
    // Store update is atomic: subscription + feature flags update together.
    setSubscription(next);
    setFeatureSet(new Set(next?.features ?? []));
  }, []);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      applySubscription(null);
      setError(null);
      return;
    }
    setLoading(true);
    try {
      // Offline reconciliation: pull the canonical state from the server.
      const current = await db.subscriptions.getForUser(user.id);
      applySubscription(current);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger l'abonnement.");
    } finally {
      setLoading(false);
    }
  }, [applySubscription, user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase.channel(`private-user-${user.id}`);

    channel.on("broadcast", { event: "subscription.updated" }, ({ payload }) => {
      const message = payload as SubscriptionEventPayload;
      if (!message?.payload) return;
      // Realtime push: update the global store immediately.
      applySubscription(buildSubscriptionSnapshot(user.id, message.payload, subscriptionRef.current));
      // Re-run feature flag evaluations by refreshing from the source of truth.
      void refresh();
    });

    channel.on("broadcast", { event: "subscription.rollback" }, ({ payload }) => {
      const message = payload as SubscriptionEventPayload;
      if (!message?.payload) return;
      applySubscription(buildSubscriptionSnapshot(user.id, message.payload, subscriptionRef.current));
      void refresh();
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void refresh();
      }
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [applySubscription, refresh, user?.id]);

  useEffect(() => {
    const subscriptionHandle = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => subscriptionHandle.remove();
  }, [refresh]);

  const hasFeature = useCallback(
    (feature: string) => featureSet.has(feature),
    [featureSet],
  );

  const value = useMemo(
    () => ({
      subscription,
      loading,
      error,
      hasFeature,
      refresh,
    }),
    [subscription, loading, error, hasFeature, refresh],
  );

  return createElement(SubscriptionContext.Provider, { value }, children);
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
