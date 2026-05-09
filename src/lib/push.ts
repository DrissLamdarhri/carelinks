/**
 * Web Push subscription helper.
 * VAPID public key must be set in your env. Real push delivery requires a
 * backend that sends notifications via webpush; here we register the
 * subscription and POST it to a `push_subscriptions` table for the worker.
 */
import { supabase } from "./supabase";

const VAPID_PUBLIC_KEY = "REPLACE_WITH_VAPID_PUBLIC_KEY";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function subscribeToPush(userId: string): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  const reg = await navigator.serviceWorker.register("/sw.js");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return false;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
  await supabase.from("push_subscriptions").upsert({
    user_id: userId,
    endpoint: sub.endpoint,
    payload: sub.toJSON(),
  });
  return true;
}
