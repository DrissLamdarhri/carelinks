import { useCallback } from "react";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { supabase } from "@/lib/supabase";

const MFA_FACTOR_KEY = "carelink_mfa_factor_id";

type MfaFactorStatus = "verified" | "unverified";

export type MfaFactor = {
  id: string;
  factor_type: "totp";
  status: MfaFactorStatus;
  created_at: string;
};

export type TotpEnrollResult = {
  factorId: string;
  qrCode: string;
  secret: string;
  uri?: string;
};

export type MfaAssuranceLevel = {
  currentLevel: "aal1" | "aal2";
  nextLevel: "aal1" | "aal2";
};

export const mfaStorage = {
  getFactorId: () => SecureStore.getItemAsync(MFA_FACTOR_KEY),
  setFactorId: (factorId: string) => SecureStore.setItemAsync(MFA_FACTOR_KEY, factorId),
  clearFactorId: () => SecureStore.deleteItemAsync(MFA_FACTOR_KEY),
};

export function normalizePhoneNumber(phone: string): string {
  const trimmed = phone.trim().replace(/\s+/g, "");
  if (trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.startsWith("0") ? trimmed.slice(1) : trimmed;
  return `+212${digits}`;
}

function normalizeBackupCode(code: string): string {
  return code.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
}

async function hashBackupCode(code: string): Promise<string> {
  const normalized = normalizeBackupCode(code);
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, normalized);
}

async function generateBackupCode(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(8);
  const digits = Array.from(bytes, (value) => String(value % 10)).join("");
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

export async function listTotpFactors(): Promise<MfaFactor[]> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  const factors = (data?.totp ?? data?.all ?? []) as Array<{
    id: string;
    factor_type: "totp";
    status: MfaFactorStatus;
    created_at: string;
  }>;
  return factors.filter((factor) => factor.factor_type === "totp");
}

export async function getAssuranceLevel(): Promise<MfaAssuranceLevel> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  const currentLevel = data?.currentLevel === "aal2" ? "aal2" : "aal1";
  const nextLevel = data?.nextLevel === "aal2" ? "aal2" : "aal1";
  return {
    currentLevel,
    nextLevel,
  };
}

export async function enrollTotp(): Promise<TotpEnrollResult> {
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
  if (error) throw error;
  if (!data?.id || !data.totp?.qr_code || !data.totp?.secret) {
    throw new Error("Impossible de démarrer l'enrôlement MFA.");
  }
  await mfaStorage.setFactorId(data.id);
  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
  };
}

export async function challengeTotp(factorId: string): Promise<string> {
  const { data, error } = await supabase.auth.mfa.challenge({ factorId });
  if (error) throw error;
  if (!data?.id) {
    throw new Error("Challenge MFA indisponible.");
  }
  return data.id;
}

export async function verifyTotp(factorId: string, code: string): Promise<void> {
  const challengeId = await challengeTotp(factorId);
  const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code });
  if (error) throw error;
}

export async function unenrollFactor(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
  await mfaStorage.clearFactorId();
}

export async function createBackupCodes(userId: string, count = 8): Promise<string[]> {
  const codes: string[] = [];
  for (let idx = 0; idx < count; idx += 1) {
    codes.push(await generateBackupCode());
  }
  const rows = await Promise.all(
    codes.map(async (code) => ({
      user_id: userId,
      code_hash: await hashBackupCode(code),
    }))
  );
  const { error } = await supabase.from("mfa_backup_codes").insert(rows);
  if (error) throw error;
  return codes;
}

export async function clearBackupCodes(userId: string): Promise<void> {
  const { error } = await supabase.from("mfa_backup_codes").delete().eq("user_id", userId);
  if (error) throw error;
}

export async function verifyBackupCode(userId: string, code: string): Promise<boolean> {
  const codeHash = await hashBackupCode(code);
  const { data, error } = await supabase
    .from("mfa_backup_codes")
    .select("id, used_at")
    .eq("user_id", userId)
    .eq("code_hash", codeHash)
    .is("used_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) return false;
  const { error: updateError } = await supabase
    .from("mfa_backup_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", data.id);
  if (updateError) throw updateError;
  return true;
}

export async function sendSmsOtp(phone: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: { channel: "sms" },
  });
  if (error) throw error;
}

export async function verifySmsOtp(phone: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    phone,
    token: code,
    type: "sms",
  });
  if (error) throw error;
}

export function useMfa(userId?: string) {
  const enroll = useCallback(() => enrollTotp(), []);
  const listFactors = useCallback(() => listTotpFactors(), []);
  const verify = useCallback((factorId: string, code: string) => verifyTotp(factorId, code), []);
  const getAal = useCallback(() => getAssuranceLevel(), []);
  const unenroll = useCallback((factorId: string) => unenrollFactor(factorId), []);
  const createCodes = useCallback(
    (count = 8) => {
      if (!userId) throw new Error("Utilisateur introuvable.");
      return createBackupCodes(userId, count);
    },
    [userId]
  );
  const clearCodes = useCallback(() => {
    if (!userId) throw new Error("Utilisateur introuvable.");
    return clearBackupCodes(userId);
  }, [userId]);
  const verifyBackup = useCallback(
    (code: string) => {
      if (!userId) throw new Error("Utilisateur introuvable.");
      return verifyBackupCode(userId, code);
    },
    [userId]
  );
  const sendSms = useCallback((phone: string) => sendSmsOtp(phone), []);
  const verifySms = useCallback((phone: string, code: string) => verifySmsOtp(phone, code), []);

  return {
    enrollTotp: enroll,
    listTotpFactors: listFactors,
    verifyTotp: verify,
    getAssuranceLevel: getAal,
    unenrollFactor: unenroll,
    createBackupCodes: createCodes,
    clearBackupCodes: clearCodes,
    verifyBackupCode: verifyBackup,
    sendSmsOtp: sendSms,
    verifySmsOtp: verifySms,
  };
}
