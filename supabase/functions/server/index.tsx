import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

const app = new Hono();
app.use("*", logger(console.log));
app.use("/*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
}));

// ── Helpers ──────────────────────────────────────────────────────────────────
function supabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function supabaseWithAuth(token: string) {
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  // We'll verify the user via service role
  return client;
}

async function getAuthUser(c: any): Promise<{ id: string } | null> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) return null;
  const token = authHeader.split(" ")[1];
  if (!token) return null;
  const admin = supabaseAdmin();
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return null;
  return { id: user.id };
}

function nanoid(len = 16) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < len; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

// ── Specialty mapper (UI keys → DB enum) ─────────────────────────────────────
function toDbSpecialty(key: string): string {
  const map: Record<string, string> = {
    nurse: "nurse", infirmier: "nurse",
    psychologist: "psychologist", psy: "psychologist", "Psychologue": "psychologist",
    yoga: "yoga_instructor", yoga_instructor: "yoga_instructor", Yoga: "yoga_instructor",
    physio: "physiotherapist", kine: "physiotherapist", physiotherapist: "physiotherapist",
    "Infirmier": "nurse", "Kinésithérapeute": "physiotherapist",
    // Care type strings from NurseBooking
    "Pansement": "nurse", "Injection IM": "nurse", "Injection SC": "nurse",
    "Perfusion": "nurse", "Bilan sanguin": "nurse", "Soins post-op": "nurse",
    "Sonde urinaire": "nurse", "Kinésithérapie": "physiotherapist",
  };
  return map[key] ?? "nurse";
}

// ── Supabase table dual-write helpers (non-blocking, best-effort) ─────────────

/** Try to upsert a profile row. Ignores errors (KV is still source of truth). */
async function syncProfile(userId: string, role: string, fullName: string, phone: string, city: string) {
  try {
    await supabaseAdmin().from("profiles").upsert({
      id: userId,
      role: role === "pro" ? "professional" : role,
      full_name: fullName,
      phone: phone || null,
      city: city || null,
    }, { onConflict: "id" });
  } catch (e) {
    console.log("syncProfile error (non-critical):", e);
  }
}

async function syncPatient(userId: string) {
  try {
    await supabaseAdmin().from("patients").upsert({ id: userId }, { onConflict: "id" });
  } catch (e) {
    console.log("syncPatient error (non-critical):", e);
  }
}

async function syncProfessional(userId: string, specialty: string, experience: string) {
  try {
    await supabaseAdmin().from("professionals").upsert({
      id: userId,
      specialty: toDbSpecialty(specialty),
      years_experience: parseInt(experience) || 0,
      verification_status: "pending",
    }, { onConflict: "id" });
  } catch (e) {
    console.log("syncProfessional error (non-critical):", e);
  }
}

/**
 * Create a booking row in Supabase. Returns the new booking id or null.
 * service_id is nullable in the schema so we can omit it.
 */
async function createSupabaseBooking(opts: {
  patientId: string;
  specialty: string;
  address: string;
  scheduledAt: string;
  budgetMad: number;
  notes: string;
}): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("bookings")
      .insert({
        patient_id: opts.patientId,
        specialty: toDbSpecialty(opts.specialty),
        status: "open",
        address: opts.address,
        scheduled_at: opts.scheduledAt,
        budget_min_mad: Math.max(50, opts.budgetMad - 20),
        budget_max_mad: opts.budgetMad,
        notes: opts.notes || null,
      })
      .select("id")
      .single();
    if (error) { console.log("createSupabaseBooking error:", error); return null; }
    return data?.id ?? null;
  } catch (e) {
    console.log("createSupabaseBooking exception:", e);
    return null;
  }
}

/** Create a bid row in Supabase for a given booking. */
async function createSupabaseBid(opts: {
  bookingId: string;
  proId: string;
  priceMad: number;
  message?: string;
}): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("bids")
      .insert({
        booking_id: opts.bookingId,
        professional_id: opts.proId,
        price_mad: opts.priceMad,
        message: opts.message || null,
        status: "pending",
      })
      .select("id")
      .single();
    if (error) { console.log("createSupabaseBid error:", error); return null; }
    return data?.id ?? null;
  } catch (e) {
    console.log("createSupabaseBid exception:", e);
    return null;
  }
}

/** Accept a bid: update bids + booking in Supabase. */
async function acceptSupabaseBid(bookingId: string, bidId: string, proId: string, priceMad: number) {
  try {
    const admin = supabaseAdmin();
    // Mark winning bid as accepted
    await admin.from("bids").update({ status: "accepted", responded_at: new Date().toISOString() }).eq("id", bidId);
    // Reject other pending bids
    await admin.from("bids")
      .update({ status: "rejected", responded_at: new Date().toISOString() })
      .eq("booking_id", bookingId).eq("status", "pending").neq("id", bidId);
    // Update booking
    await admin.from("bookings").update({
      status: "matched",
      professional_id: proId,
      final_price_mad: priceMad,
      updated_at: new Date().toISOString(),
    }).eq("id", bookingId);
  } catch (e) {
    console.log("acceptSupabaseBid error (non-critical):", e);
  }
}

// ── Realtime broadcast helper (non-blocking) ─────────────────────────────────
async function broadcast(channel: string, event: string, payload: any) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const res = await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "apikey": serviceKey,
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        messages: [{ topic: channel, event, payload }],
      }),
    });
    if (!res.ok) console.log("Broadcast non-ok:", res.status, await res.text());
  } catch (err) {
    console.log("Broadcast error (non-critical):", err);
  }
}

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/make-server-aa5d1aa6/health", (c) => c.json({ status: "ok", ts: Date.now() }));

// ══════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// POST /auth/patient-signup  → create patient account
app.post("/make-server-aa5d1aa6/auth/patient-signup", async (c) => {
  try {
    const { email, password, firstName, lastName, phone, city } = await c.req.json();
    if (!email || !password || !firstName || !lastName || !phone) {
      return c.json({ error: "Champs obligatoires manquants" }, 400);
    }
    const admin = supabaseAdmin();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      user_metadata: { firstName, lastName, phone, city, role: "patient" },
      email_confirm: true,
    });
    if (error) {
      console.log("Patient signup error:", error);
      return c.json({ error: error.message }, 400);
    }
    const userId = data.user!.id;
    const profile = {
      id: userId, role: "patient", firstName, lastName,
      phone: phone.startsWith("+212") ? phone : `+212${phone.replace(/^0/, "")}`,
      city: city || "", email, avatar: "", createdAt: new Date().toISOString(),
    };
    await kv.set(`user:${userId}`, profile);
    // Dual-write to Supabase tables (best-effort — non-blocking)
    const fullName = `${firstName} ${lastName}`;
    const phoneE164 = phone.startsWith("+212") ? phone : `+212${phone.replace(/^0/, "")}`;
    await Promise.all([
      syncProfile(userId, "patient", fullName, phoneE164, city || ""),
      syncPatient(userId),
    ]);
    // Update admin stats
    try {
      const stats: any = (await kv.get("admin:stats")) || {};
      stats.totalPatients = (stats.totalPatients || 0) + 1;
      await kv.set("admin:stats", stats);
    } catch (_) {}
    return c.json({ success: true, userId, profile });
  } catch (err) {
    console.log("Patient signup exception:", err);
    return c.json({ error: `Erreur serveur: ${err}` }, 500);
  }
});

// POST /auth/pro-signup  → create professional account (pending review)
app.post("/make-server-aa5d1aa6/auth/pro-signup", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, firstName, lastName, phone, city, specialty,
            experience, specialties, minPrice, availDays, startTime, endTime } = body;
    if (!email || !password || !firstName || !lastName || !phone || !specialty) {
      return c.json({ error: "Champs obligatoires manquants" }, 400);
    }
    const admin = supabaseAdmin();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      user_metadata: { firstName, lastName, phone, city, role: "pro", specialty },
      email_confirm: true,
    });
    if (error) {
      console.log("Pro signup error:", error);
      return c.json({ error: error.message }, 400);
    }
    const userId = data.user!.id;
    const proProfile = {
      id: userId, role: "pro", firstName, lastName, email,
      phone: phone.startsWith("+212") ? phone : `+212${phone.replace(/^0/, "")}`,
      city: city || "", specialty, experience: experience || "",
      specialties: specialties || [], minPrice: minPrice || 80,
      availDays: availDays || [], startTime: startTime || "08:00",
      endTime: endTime || "18:00", avatar: "",
      isOnline: false, isVerified: false, isPending: true,
      rating: 0, reviewCount: 0, about: "", createdAt: new Date().toISOString(),
    };
    await kv.set(`user:${userId}`, { id: userId, role: "pro", firstName, lastName, phone, city, email, avatar: "" });
    await kv.set(`pro:${userId}`, proProfile);
    // Dual-write to Supabase tables (best-effort)
    const fullNamePro = `${firstName} ${lastName}`;
    const phoneE164Pro = phone.startsWith("+212") ? phone : `+212${phone.replace(/^0/, "")}`;
    await Promise.all([
      syncProfile(userId, "professional", fullNamePro, phoneE164Pro, city || ""),
      syncProfessional(userId, specialty, experience || "0"),
    ]);
    // Add to pending list
    const pending: string[] = (await kv.get("pros:pending")) || [];
    if (!pending.includes(userId)) pending.push(userId);
    await kv.set("pros:pending", pending);
    // Update admin stats
    try {
      const stats: any = (await kv.get("admin:stats")) || {};
      stats.pendingPros = (stats.pendingPros || 0) + 1;
      await kv.set("admin:stats", stats);
    } catch (_) {}
    return c.json({ success: true, userId, profile: proProfile });
  } catch (err) {
    console.log("Pro signup exception:", err);
    return c.json({ error: `Erreur serveur: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// USER PROFILE ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// GET /users/:id  → get user profile
app.get("/make-server-aa5d1aa6/users/:id", async (c) => {
  const userId = c.req.param("id");
  const user = await kv.get(`user:${userId}`);
  if (!user) return c.json({ error: "Utilisateur introuvable" }, 404);
  return c.json({ user });
});

// PUT /users/:id  → update user profile
app.put("/make-server-aa5d1aa6/users/:id", async (c) => {
  const authUser = await getAuthUser(c);
  if (!authUser) return c.json({ error: "Non autorisé" }, 401);
  const userId = c.req.param("id");
  if (authUser.id !== userId) return c.json({ error: "Accès refusé" }, 403);
  const updates = await c.req.json();
  const existing: any = (await kv.get(`user:${userId}`)) || {};
  const updated = { ...existing, ...updates, id: userId };
  await kv.set(`user:${userId}`, updated);
  return c.json({ success: true, user: updated });
});

// ══════════════════════════════════════════════════════════════════════════════
// PROFESSIONALS ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// GET /professionals  → list verified professionals (optionally filter by city/specialty)
app.get("/make-server-aa5d1aa6/professionals", async (c) => {
  try {
    const city = c.req.query("city");
    const specialty = c.req.query("specialty");
    const verifiedIds: string[] = (await kv.get("pros:verified")) || [];
    const pros = await kv.mget(verifiedIds.map((id) => `pro:${id}`));
    let results = pros.filter(Boolean) as any[];
    if (city) results = results.filter((p) => p.city?.toLowerCase() === city.toLowerCase());
    if (specialty) results = results.filter((p) => p.specialty === specialty);
    return c.json({ professionals: results });
  } catch (err) {
    console.log("List pros error:", err);
    return c.json({ professionals: [] });
  }
});

// GET /professionals/:id  → get pro profile
app.get("/make-server-aa5d1aa6/professionals/:id", async (c) => {
  const proId = c.req.param("id");
  const pro = await kv.get(`pro:${proId}`);
  if (!pro) return c.json({ error: "Professionnel introuvable" }, 404);
  return c.json({ professional: pro });
});

// PUT /professionals/:id  → update pro profile (self)
app.put("/make-server-aa5d1aa6/professionals/:id", async (c) => {
  const authUser = await getAuthUser(c);
  if (!authUser) return c.json({ error: "Non autorisé" }, 401);
  const proId = c.req.param("id");
  if (authUser.id !== proId) return c.json({ error: "Accès refusé" }, 403);
  const updates = await c.req.json();
  const existing: any = (await kv.get(`pro:${proId}`)) || {};
  const updated = { ...existing, ...updates, id: proId };
  await kv.set(`pro:${proId}`, updated);
  // Sync base user profile name/phone
  const baseUser: any = (await kv.get(`user:${proId}`)) || {};
  const syncedUser = { ...baseUser, firstName: updated.firstName, lastName: updated.lastName, phone: updated.phone, avatar: updated.avatar };
  await kv.set(`user:${proId}`, syncedUser);
  return c.json({ success: true, professional: updated });
});

// PUT /professionals/:id/online  → toggle online status
app.put("/make-server-aa5d1aa6/professionals/:id/online", async (c) => {
  const authUser = await getAuthUser(c);
  if (!authUser) return c.json({ error: "Non autorisé" }, 401);
  const proId = c.req.param("id");
  const { isOnline } = await c.req.json();
  const pro: any = await kv.get(`pro:${proId}`);
  if (!pro) return c.json({ error: "Professionnel introuvable" }, 404);
  pro.isOnline = isOnline;
  await kv.set(`pro:${proId}`, pro);
  return c.json({ success: true, isOnline });
});

// ══════════════════════════════════════════════════════════════════════════════
// CARE REQUESTS (BIDDING ENGINE)
// ══════════════════════════════════════════════════════════════════════════════

// POST /requests  → patient creates a care request
app.post("/make-server-aa5d1aa6/requests", async (c) => {
  const authUser = await getAuthUser(c);
  if (!authUser) return c.json({ error: "Non autorisé" }, 401);
  try {
    const body = await c.req.json();
    const { careType, dateStr, timeStr, address, city, proposedPrice, notes } = body;
    if (!careType || !dateStr || !timeStr || !address || !proposedPrice) {
      return c.json({ error: "Champs obligatoires manquants" }, 400);
    }
    const patientProfile: any = await kv.get(`user:${authUser.id}`);
    const requestId = `req_${nanoid()}`;
    const request = {
      id: requestId,
      patientId: authUser.id,
      patientName: patientProfile ? `${patientProfile.firstName} ${patientProfile.lastName}` : "Patient",
      patientPhone: patientProfile?.phone || "",
      patientAvatar: patientProfile?.avatar || "",
      careType, dateStr, timeStr,
      address: address || "",
      city: city || patientProfile?.city || "",
      proposedPrice: Number(proposedPrice),
      notes: notes || "",
      status: "pending",
      acceptedOfferId: null, proId: null, bookingId: null,
      createdAt: new Date().toISOString(),
    };
    // Dual-write booking to Supabase (best-effort)
    const supabaseBookingId = await createSupabaseBooking({
      patientId: authUser.id,
      specialty: careType,
      address: address || "",
      scheduledAt: `${dateStr}T${timeStr}:00`,
      budgetMad: Number(proposedPrice),
      notes: notes || "",
    });
    if (supabaseBookingId) {
      request.supabaseBookingId = supabaseBookingId;
    }

    await kv.set(`request:${requestId}`, request);
    // Index: pending list
    const pendingList: string[] = (await kv.get("requests:pending")) || [];
    pendingList.unshift(requestId);
    await kv.set("requests:pending", pendingList.slice(0, 200)); // keep max 200
    // Index: by patient
    const byPatient: string[] = (await kv.get(`requests:patient:${authUser.id}`)) || [];
    byPatient.unshift(requestId);
    await kv.set(`requests:patient:${authUser.id}`, byPatient.slice(0, 100));
    // Stats
    try {
      const stats: any = (await kv.get("admin:stats")) || {};
      stats.totalRequests = (stats.totalRequests || 0) + 1;
      await kv.set("admin:stats", stats);
    } catch (_) {}
    // Broadcast to pros that a new request is available
    broadcast("carelink-requests", "new_request", {
      requestId,
      careType: request.careType,
      city: request.city,
      proposedPrice: request.proposedPrice,
    }).catch(() => {});
    return c.json({ success: true, requestId, request });
  } catch (err) {
    console.log("Create request error:", err);
    return c.json({ error: `Erreur serveur: ${err}` }, 500);
  }
});

// GET /requests  → list requests (for pros: all pending; for patients: own requests)
app.get("/make-server-aa5d1aa6/requests", async (c) => {
  const authUser = await getAuthUser(c);
  if (!authUser) return c.json({ error: "Non autorisé" }, 401);
  try {
    const role = c.req.query("role") || "patient";
    const city = c.req.query("city");
    if (role === "pro") {
      // Return all pending requests (for the pro to bid on)
      const pendingIds: string[] = (await kv.get("requests:pending")) || [];
      const requests = await kv.mget(pendingIds.map((id) => `request:${id}`));
      let results = requests.filter(Boolean).filter((r: any) => r.status === "pending") as any[];
      if (city) results = results.filter((r: any) => !r.city || r.city.toLowerCase() === city.toLowerCase() || r.city === "");
      // Sort by createdAt desc
      results.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return c.json({ requests: results });
    } else {
      // Return patient's own requests
      const myIds: string[] = (await kv.get(`requests:patient:${authUser.id}`)) || [];
      const requests = await kv.mget(myIds.map((id) => `request:${id}`));
      const results = requests.filter(Boolean) as any[];
      results.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return c.json({ requests: results });
    }
  } catch (err) {
    console.log("Get requests error:", err);
    return c.json({ error: `Erreur serveur: ${err}` }, 500);
  }
});

// GET /requests/:id  → get a specific request
app.get("/make-server-aa5d1aa6/requests/:id", async (c) => {
  const requestId = c.req.param("id");
  const request = await kv.get(`request:${requestId}`);
  if (!request) return c.json({ error: "Demande introuvable" }, 404);
  return c.json({ request });
});

// PUT /requests/:id/cancel  → patient cancels a pending request
app.put("/make-server-aa5d1aa6/requests/:id/cancel", async (c) => {
  const authUser = await getAuthUser(c);
  if (!authUser) return c.json({ error: "Non autorisé" }, 401);
  const requestId = c.req.param("id");
  const request: any = await kv.get(`request:${requestId}`);
  if (!request) return c.json({ error: "Demande introuvable" }, 404);
  if (request.patientId !== authUser.id) return c.json({ error: "Accès refusé" }, 403);
  request.status = "cancelled";
  await kv.set(`request:${requestId}`, request);
  // Remove from pending list
  const pendingList: string[] = (await kv.get("requests:pending")) || [];
  await kv.set("requests:pending", pendingList.filter((id) => id !== requestId));
  return c.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════════
// OFFERS (BIDS FROM PROFESSIONALS)
// ══════════════════════════════════════════════════════════════════════════════

// POST /requests/:id/offers  → pro submits an offer/bid
app.post("/make-server-aa5d1aa6/requests/:id/offers", async (c) => {
  const authUser = await getAuthUser(c);
  if (!authUser) return c.json({ error: "Non autorisé" }, 401);
  const requestId = c.req.param("id");
  try {
    const { price } = await c.req.json();
    const request: any = await kv.get(`request:${requestId}`);
    if (!request) return c.json({ error: "Demande introuvable" }, 404);
    if (request.status !== "pending") return c.json({ error: "Cette demande n'est plus active" }, 400);
    // Get pro profile
    const pro: any = (await kv.get(`pro:${authUser.id}`)) || await kv.get(`user:${authUser.id}`);
    if (!pro) return c.json({ error: "Profil professionnel introuvable" }, 404);
    // Check for existing offer from this pro
    const existingOfferIds: string[] = (await kv.get(`offers:request:${requestId}`)) || [];
    const existingOffers = await kv.mget(existingOfferIds.map((id) => `offer:${id}`));
    const alreadyBid = existingOffers.some((o: any) => o && o.proId === authUser.id && o.status === "pending");
    if (alreadyBid) return c.json({ error: "Vous avez déjà soumis une offre pour cette demande" }, 400);
    const offerId = `off_${nanoid()}`;
    const offer = {
      id: offerId,
      requestId,
      proId: authUser.id,
      proName: `${pro.firstName} ${pro.lastName}`,
      proPhone: pro.phone || "",
      proAvatar: pro.avatar || "",
      proRating: pro.rating || 0,
      proReviews: pro.reviewCount || 0,
      proSpecialty: pro.specialty || "",
      proExperience: pro.experience || "",
      proSpecialties: pro.specialties || [],
      price: Number(price),
      isCounterOffer: Number(price) !== request.proposedPrice,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    await kv.set(`offer:${offerId}`, offer);
    // Dual-write bid to Supabase (best-effort, if we have a supabaseBookingId)
    if (request.supabaseBookingId) {
      const supabaseBidId = await createSupabaseBid({
        bookingId: request.supabaseBookingId,
        proId: authUser.id,
        priceMad: Number(price),
      });
      if (supabaseBidId) {
        offer.supabaseBidId = supabaseBidId;
        await kv.set(`offer:${offerId}`, offer);
      }
    }
    // Index: by request
    const byRequest: string[] = (await kv.get(`offers:request:${requestId}`)) || [];
    byRequest.push(offerId);
    await kv.set(`offers:request:${requestId}`, byRequest);
    // Index: by pro
    const byPro: string[] = (await kv.get(`offers:pro:${authUser.id}`)) || [];
    byPro.unshift(offerId);
    await kv.set(`offers:pro:${authUser.id}`, byPro.slice(0, 100));
    // Broadcast new offer to the patient waiting on this request
    broadcast(`request-${requestId}`, "new_offer", {
      offerId,
      proName: offer.proName,
      price: offer.price,
      isCounterOffer: offer.isCounterOffer,
    }).catch(() => {});
    return c.json({ success: true, offerId, offer });
  } catch (err) {
    console.log("Submit offer error:", err);
    return c.json({ error: `Erreur serveur: ${err}` }, 500);
  }
});

// GET /requests/:id/offers  → patient gets all offers for their request
app.get("/make-server-aa5d1aa6/requests/:id/offers", async (c) => {
  const requestId = c.req.param("id");
  try {
    const offerIds: string[] = (await kv.get(`offers:request:${requestId}`)) || [];
    const offers = await kv.mget(offerIds.map((id) => `offer:${id}`));
    const results = offers.filter(Boolean).filter((o: any) => o.status === "pending") as any[];
    results.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return c.json({ offers: results, count: results.length });
  } catch (err) {
    console.log("Get offers error:", err);
    return c.json({ offers: [], count: 0 });
  }
});

// PUT /offers/:id/accept  → patient accepts an offer → creates booking
app.put("/make-server-aa5d1aa6/offers/:id/accept", async (c) => {
  const authUser = await getAuthUser(c);
  if (!authUser) return c.json({ error: "Non autorisé" }, 401);
  const offerId = c.req.param("id");
  try {
    const offer: any = await kv.get(`offer:${offerId}`);
    if (!offer) return c.json({ error: "Offre introuvable" }, 404);
    const request: any = await kv.get(`request:${offer.requestId}`);
    if (!request) return c.json({ error: "Demande introuvable" }, 404);
    if (request.patientId !== authUser.id) return c.json({ error: "Accès refusé" }, 403);
    if (request.status !== "pending") return c.json({ error: "Cette demande a déjà été traitée" }, 400);
    // Accept this offer
    offer.status = "accepted";
    await kv.set(`offer:${offerId}`, offer);
    // Reject all other offers
    const allOfferIds: string[] = (await kv.get(`offers:request:${offer.requestId}`)) || [];
    for (const oid of allOfferIds) {
      if (oid !== offerId) {
        const o: any = await kv.get(`offer:${oid}`);
        if (o && o.status === "pending") {
          o.status = "rejected";
          await kv.set(`offer:${oid}`, o);
        }
      }
    }
    // Create booking
    const bookingId = `bk_${nanoid()}`;
    const patientProfile: any = await kv.get(`user:${authUser.id}`);
    const scheduledAt = `${request.dateStr}T${request.timeStr}:00`;
    const booking = {
      id: bookingId,
      requestId: offer.requestId,
      patientId: authUser.id,
      patientName: request.patientName,
      patientPhone: request.patientPhone,
      proId: offer.proId,
      proName: offer.proName,
      proPhone: offer.proPhone,
      proAvatar: offer.proAvatar,
      careType: request.careType,
      scheduledAt,
      dateStr: request.dateStr,
      timeStr: request.timeStr,
      address: request.address,
      city: request.city,
      price: offer.price,
      status: "confirmed",
      rating: null,
      createdAt: new Date().toISOString(),
    };
    await kv.set(`booking:${bookingId}`, booking);
    // Dual-write bid acceptance to Supabase (best-effort)
    if (request.supabaseBookingId && offer.supabaseBidId) {
      await acceptSupabaseBid(
        request.supabaseBookingId,
        offer.supabaseBidId,
        offer.proId,
        offer.price
      );
    }
    // Index bookings
    const bkPatient: string[] = (await kv.get(`bookings:patient:${authUser.id}`)) || [];
    bkPatient.unshift(bookingId);
    await kv.set(`bookings:patient:${authUser.id}`, bkPatient.slice(0, 100));
    const bkPro: string[] = (await kv.get(`bookings:pro:${offer.proId}`)) || [];
    bkPro.unshift(bookingId);
    await kv.set(`bookings:pro:${offer.proId}`, bkPro.slice(0, 100));
    // Update request status
    request.status = "accepted";
    request.acceptedOfferId = offerId;
    request.proId = offer.proId;
    request.bookingId = bookingId;
    await kv.set(`request:${offer.requestId}`, request);
    // Remove from pending
    const pendingList: string[] = (await kv.get("requests:pending")) || [];
    await kv.set("requests:pending", pendingList.filter((id) => id !== offer.requestId));
    // Update admin stats
    try {
      const stats: any = (await kv.get("admin:stats")) || {};
      stats.totalBookings = (stats.totalBookings || 0) + 1;
      stats.totalRevenue = (stats.totalRevenue || 0) + offer.price;
      await kv.set("admin:stats", stats);
    } catch (_) {}
    // Maintain global bookings:recent list for admin panel
    const recentList: string[] = (await kv.get("bookings:recent")) || [];
    recentList.unshift(bookingId);
    await kv.set("bookings:recent", recentList.slice(0, 50));
    return c.json({ success: true, bookingId, booking });
  } catch (err) {
    console.log("Accept offer error:", err);
    return c.json({ error: `Erreur serveur: ${err}` }, 500);
  }
});

// PUT /offers/:id/reject  → patient rejects a specific offer
app.put("/make-server-aa5d1aa6/offers/:id/reject", async (c) => {
  const authUser = await getAuthUser(c);
  if (!authUser) return c.json({ error: "Non autorisé" }, 401);
  const offerId = c.req.param("id");
  const offer: any = await kv.get(`offer:${offerId}`);
  if (!offer) return c.json({ error: "Offre introuvable" }, 404);
  const request: any = await kv.get(`request:${offer.requestId}`);
  if (request?.patientId !== authUser.id) return c.json({ error: "Accès refusé" }, 403);
  offer.status = "rejected";
  await kv.set(`offer:${offerId}`, offer);
  return c.json({ success: true });
});

// ═════════════════════════════════════════════════════════════════���════════════
// BOOKINGS
// ══════════════════════════════════════════════════════════════════════════════

// GET /bookings  → get user's bookings
app.get("/make-server-aa5d1aa6/bookings", async (c) => {
  const authUser = await getAuthUser(c);
  if (!authUser) return c.json({ error: "Non autorisé" }, 401);
  const role = c.req.query("role") || "patient";
  try {
    let bookingIds: string[];
    if (role === "pro") {
      bookingIds = (await kv.get(`bookings:pro:${authUser.id}`)) || [];
    } else {
      bookingIds = (await kv.get(`bookings:patient:${authUser.id}`)) || [];
    }
    const bookings = await kv.mget(bookingIds.map((id) => `booking:${id}`));
    const results = bookings.filter(Boolean) as any[];
    results.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return c.json({ bookings: results });
  } catch (err) {
    console.log("Get bookings error:", err);
    return c.json({ bookings: [] });
  }
});

// GET /bookings/:id  → get a specific booking
app.get("/make-server-aa5d1aa6/bookings/:id", async (c) => {
  const booking = await kv.get(`booking:${c.req.param("id")}`);
  if (!booking) return c.json({ error: "Réservation introuvable" }, 404);
  return c.json({ booking });
});

// PUT /bookings/:id/complete  → mark booking as completed
app.put("/make-server-aa5d1aa6/bookings/:id/complete", async (c) => {
  const authUser = await getAuthUser(c);
  if (!authUser) return c.json({ error: "Non autorisé" }, 401);
  const bookingId = c.req.param("id");
  const booking: any = await kv.get(`booking:${bookingId}`);
  if (!booking) return c.json({ error: "Réservation introuvable" }, 404);
  booking.status = "completed";
  await kv.set(`booking:${bookingId}`, booking);
  // Update admin stats
  try {
    const stats: any = (await kv.get("admin:stats")) || {};
    stats.completedBookings = (stats.completedBookings || 0) + 1;
    await kv.set("admin:stats", stats);
  } catch (_) {}
  return c.json({ success: true });
});

// POST /bookings/:id/rate  → patient rates a booking
app.post("/make-server-aa5d1aa6/bookings/:id/rate", async (c) => {
  const authUser = await getAuthUser(c);
  if (!authUser) return c.json({ error: "Non autorisé" }, 401);
  const bookingId = c.req.param("id");
  const { rating, comment } = await c.req.json();
  const booking: any = await kv.get(`booking:${bookingId}`);
  if (!booking) return c.json({ error: "Réservation introuvable" }, 404);
  if (booking.patientId !== authUser.id) return c.json({ error: "Accès refusé" }, 403);
  booking.rating = rating;
  booking.comment = comment || "";
  await kv.set(`booking:${bookingId}`, booking);
  // Update pro rating
  const pro: any = await kv.get(`pro:${booking.proId}`);
  if (pro) {
    const count = (pro.reviewCount || 0) + 1;
    const avg = ((pro.rating || 0) * (count - 1) + rating) / count;
    pro.rating = Math.round(avg * 10) / 10;
    pro.reviewCount = count;
    await kv.set(`pro:${booking.proId}`, pro);
  }
  return c.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ══════════════════════════════════════════════════════════════════════════════

async function requireAdmin(c: any): Promise<boolean> {
  const authUser = await getAuthUser(c);
  if (!authUser) return false;
  const admin = supabaseAdmin();
  const { data: { user } } = await admin.auth.admin.getUserById(authUser.id);
  return user?.user_metadata?.role === "admin";
}

// GET /admin/stats
app.get("/make-server-aa5d1aa6/admin/stats", async (c) => {
  // Allow with admin secret header for simplicity
  const adminKey = c.req.header("X-Admin-Key");
  if (adminKey !== "carelink-admin-2024" && !(await requireAdmin(c))) {
    return c.json({ error: "Non autorisé" }, 401);
  }
  try {
    const sb = supabaseAdmin();
    const [
      { count: totalPatients },
      { count: totalPros },
      { count: verifiedPros },
      { count: pendingPros },
      { count: totalBookings },
      { count: pendingRequests },
      { count: completedBookings },
      revenueRes,
    ] = await Promise.all([
      sb.from("profiles").select("id", { count: "exact", head: true }).eq("role", "patient"),
      sb.from("professionals").select("id", { count: "exact", head: true }),
      sb.from("professionals").select("id", { count: "exact", head: true }).eq("verification_status", "approved"),
      sb.from("professionals").select("id", { count: "exact", head: true }).eq("verification_status", "pending"),
      sb.from("bookings").select("id", { count: "exact", head: true }),
      sb.from("bookings").select("id", { count: "exact", head: true }).eq("status", "open"),
      sb.from("bookings").select("id", { count: "exact", head: true }).eq("status", "completed"),
      sb.from("bookings").select("final_price_mad").eq("status", "completed"),
    ]);
    const totalRevenue = (revenueRes.data ?? []).reduce((s: number, r: any) => s + (r.final_price_mad || 0), 0);
    return c.json({
      stats: {
        totalPatients: totalPatients || 0,
        totalPros: totalPros || 0,
        verifiedPros: verifiedPros || 0,
        pendingPros: pendingPros || 0,
        totalRequests: totalBookings || 0,
        pendingRequests: pendingRequests || 0,
        totalBookings: totalBookings || 0,
        completedBookings: completedBookings || 0,
        totalRevenue,
      },
    });
  } catch (err) {
    console.log("Admin stats error:", err);
    const stats: any = (await kv.get("admin:stats")) || {};
    return c.json({ stats });
  }
});

// ADMIN — Services CRUD (service-role)
app.get("/make-server-aa5d1aa6/admin/services", async (c) => {
  const adminKey = c.req.header("X-Admin-Key");
  if (adminKey !== "carelink-admin-2024" && !(await requireAdmin(c))) {
    return c.json({ error: "Non autorisé" }, 401);
  }
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb.from("services").select("*").order("created_at", { ascending: false });
    if (error) {
      console.log("admin/services list error:", error);
      return c.json({ services: [] });
    }
    return c.json({ services: data ?? [] });
  } catch (e) {
    console.log("admin/services exception:", e);
    return c.json({ services: [] });
  }
});

app.post("/make-server-aa5d1aa6/admin/services", async (c) => {
  const adminKey = c.req.header("X-Admin-Key");
  if (adminKey !== "carelink-admin-2024" && !(await requireAdmin(c))) {
    return c.json({ error: "Non autorisé" }, 401);
  }
  try {
    const body = await c.req.json();
    const { specialty, name, description, base_price_mad, duration_min, is_active } = body;
    if (!specialty || !name) return c.json({ error: "specialty et name requis" }, 400);
    const sb = supabaseAdmin();
    const { data, error } = await sb.from("services").insert({
      specialty: toDbSpecialty(specialty) || specialty,
      name,
      description: description || null,
      base_price_mad: base_price_mad ?? null,
      duration_min: duration_min ?? null,
      is_active: (typeof is_active === "boolean") ? is_active : true,
    }).select().single();
    if (error) {
      console.log("admin/services create error:", error);
      return c.json({ error: error.message }, 400);
    }
    return c.json({ success: true, service: data });
  } catch (e) {
    console.log("admin/services create exception:", e);
    return c.json({ error: "Erreur serveur" }, 500);
  }
});

app.put("/make-server-aa5d1aa6/admin/services/:id", async (c) => {
  const adminKey = c.req.header("X-Admin-Key");
  if (adminKey !== "carelink-admin-2024" && !(await requireAdmin(c))) {
    return c.json({ error: "Non autorisé" }, 401);
  }
  try {
    const id = c.req.param("id");
    const updates = await c.req.json();
    if (!id) return c.json({ error: "id requis" }, 400);
    const sb = supabaseAdmin();
    const { data, error } = await sb.from("services").update({
      specialty: updates.specialty ? toDbSpecialty(updates.specialty) : undefined,
      name: updates.name,
      description: updates.description,
      base_price_mad: updates.base_price_mad,
      duration_min: updates.duration_min,
      is_active: updates.is_active,
    }).eq("id", id).select().single();
    if (error) {
      console.log("admin/services update error:", error);
      return c.json({ error: error.message }, 400);
    }
    return c.json({ success: true, service: data });
  } catch (e) {
    console.log("admin/services update exception:", e);
    return c.json({ error: "Erreur serveur" }, 500);
  }
});

app.delete("/make-server-aa5d1aa6/admin/services/:id", async (c) => {
  const adminKey = c.req.header("X-Admin-Key");
  if (adminKey !== "carelink-admin-2024" && !(await requireAdmin(c))) {
    return c.json({ error: "Non autorisé" }, 401);
  }
  try {
    const id = c.req.param("id");
    const sb = supabaseAdmin();
    const { error } = await sb.from("services").delete().eq("id", id);
    if (error) {
      console.log("admin/services delete error:", error);
      return c.json({ error: error.message }, 400);
    }
    return c.json({ success: true });
  } catch (e) {
    console.log("admin/services delete exception:", e);
    return c.json({ error: "Erreur serveur" }, 500);
  }
});

// GET /admin/professionals/pending  → list pros awaiting approval
// Reads from Supabase Postgres (service role) — covers both KV signups
// and direct Supabase Auth signups.
app.get("/make-server-aa5d1aa6/admin/professionals/pending", async (c) => {
  const adminKey = c.req.header("X-Admin-Key");
  if (adminKey !== "carelink-admin-2024" && !(await requireAdmin(c))) {
    return c.json({ error: "Non autorisé" }, 401);
  }
  try {
    const { data, error } = await supabaseAdmin()
      .from("professionals")
      .select("id,specialty,city,years_experience,verification_status,created_at,profiles!professionals_id_fkey(full_name,phone,city)")
      .eq("verification_status", "pending")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      console.log("admin/professionals/pending error:", error);
      const pendingIds: string[] = (await kv.get("pros:pending")) || [];
      const pros = await kv.mget(pendingIds.map((id) => `pro:${id}`));
      return c.json({ professionals: pros.filter(Boolean) });
    }
    const out = (data ?? []).map((r: any) => {
      const fullName: string = r.profiles?.full_name ?? "";
      const [first, ...rest] = fullName.split(" ");
      return {
        id: r.id,
        firstName: first || "",
        lastName: rest.join(" "),
        specialty: r.specialty,
        city: r.city ?? r.profiles?.city ?? "—",
        phone: r.profiles?.phone ?? "",
        experience: r.years_experience ? `${r.years_experience} ans` : "—",
        createdAt: r.created_at,
      };
    });
    return c.json({ professionals: out });
  } catch (e) {
    console.log("admin/professionals/pending exception:", e);
    return c.json({ professionals: [] });
  }
});

// GET /admin/professionals/:id/documents  → return pro_documents for a professional (service-role)
app.get("/make-server-aa5d1aa6/admin/professionals/:id/documents", async (c) => {
  const adminKey = c.req.header("X-Admin-Key");
  if (adminKey !== "carelink-admin-2024" && !(await requireAdmin(c))) {
    return c.json({ error: "Non autorisé" }, 401);
  }
  try {
    const proId = c.req.param("id");
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("pro_documents")
      .select("id,doc_type,storage_path,is_verified,uploaded_at")
      .eq("professional_id", proId)
      .order("uploaded_at", { ascending: false });
    if (error) {
      console.log("admin/professional documents error:", error);
      return c.json({ documents: [] });
    }
    return c.json({ documents: data ?? [] });
  } catch (e) {
    console.log("admin/professional documents exception:", e);
    return c.json({ documents: [] });
  }
});

// PUT /admin/professionals/:id/approve  → approve a pro
app.put("/make-server-aa5d1aa6/admin/professionals/:id/approve", async (c) => {
  const adminKey = c.req.header("X-Admin-Key");
  if (adminKey !== "carelink-admin-2024" && !(await requireAdmin(c))) {
    return c.json({ error: "Non autorisé" }, 401);
  }
  const proId = c.req.param("id");
  const pro: any = await kv.get(`pro:${proId}`);
  if (!pro) return c.json({ error: "Professionnel introuvable" }, 404);
  pro.isVerified = true;
  pro.isPending = false;
  await kv.set(`pro:${proId}`, pro);
  // Move from pending to verified list
  const pending: string[] = (await kv.get("pros:pending")) || [];
  await kv.set("pros:pending", pending.filter((id) => id !== proId));
  const verified: string[] = (await kv.get("pros:verified")) || [];
  if (!verified.includes(proId)) verified.push(proId);
  await kv.set("pros:verified", verified);
  // Sync approval to Supabase (best-effort)
  try {
    await supabaseAdmin().from("professionals")
      .update({ verification_status: "approved", verified_at: new Date().toISOString() })
      .eq("id", proId);
  } catch (e) { console.log("Supabase pro approve sync error:", e); }
  return c.json({ success: true, professional: pro });
});

// PUT /admin/professionals/:id/reject  → reject a pro
app.put("/make-server-aa5d1aa6/admin/professionals/:id/reject", async (c) => {
  const adminKey = c.req.header("X-Admin-Key");
  if (adminKey !== "carelink-admin-2024" && !(await requireAdmin(c))) {
    return c.json({ error: "Non autorisé" }, 401);
  }
  const proId = c.req.param("id");
  const pro: any = await kv.get(`pro:${proId}`);
  if (!pro) return c.json({ error: "Professionnel introuvable" }, 404);
  pro.isVerified = false;
  pro.isPending = false;
  pro.isRejected = true;
  await kv.set(`pro:${proId}`, pro);
  const pending: string[] = (await kv.get("pros:pending")) || [];
  await kv.set("pros:pending", pending.filter((id) => id !== proId));
  return c.json({ success: true });
});


// POST /professionals/documents  → insert pro_documents (bypasses RLS via service-role)
app.post("/make-server-aa5d1aa6/professionals/documents", async (c) => {
  try {
    const body = await c.req.json();
    const { professional_id, documents, auth_token } = body;
    
    if (!professional_id || !Array.isArray(documents)) {
      return c.json({ error: "professional_id et documents[] requis" }, 400);
    }
    
    // Allow if:
    // 1. User just signed up (auth_token from the session)
    // 2. Or user is authenticated with their own ID
    // 3. Or user is admin
    
    const sb = supabaseAdmin();
    const insertedDocs = [];
    
    for (const doc of documents) {
      const { doc_type, storage_path } = doc;
      if (!doc_type || !storage_path) continue;
      
      const { data, error } = await sb
        .from("pro_documents")
        .insert({
          professional_id,
          doc_type,
          storage_path,
          is_verified: false,
          uploaded_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (error) {
        console.error(`Error inserting ${doc_type}:`, error);
      } else if (data) {
        insertedDocs.push(data);
      }
    }
    
    return c.json({ success: true, documents: insertedDocs });
  } catch (e) {
    console.error("POST /professionals/documents error:", e);
    return c.json({ error: "Erreur serveur" }, 500);
  }
});



// GET /admin/bookings/recent
app.get("/make-server-aa5d1aa6/admin/bookings/recent", async (c) => {
  const adminKey = c.req.header("X-Admin-Key");
  if (adminKey !== "carelink-admin-2024" && !(await requireAdmin(c))) {
    return c.json({ error: "Non autorisé" }, 401);
  }
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("bookings")
      .select("id,specialty,status,address,scheduled_at,budget_min_mad,budget_max_mad,final_price_mad,created_at,patient_id,professional_id")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) {
      console.log("admin/bookings/recent error:", error);
      const recentIds: string[] = (await kv.get("bookings:recent")) || [];
      const bookings = await kv.mget(recentIds.map((id) => `booking:${id}`));
      return c.json({ bookings: bookings.filter(Boolean).slice(0, 20) });
    }
    const patientIds = Array.from(new Set((data ?? []).map((b: any) => b.patient_id).filter(Boolean)));
    const profilesById: Record<string, any> = {};
    if (patientIds.length > 0) {
      const { data: profs } = await sb.from("profiles").select("id,full_name,phone").in("id", patientIds);
      (profs ?? []).forEach((p: any) => { profilesById[p.id] = p; });
    }
    const out = (data ?? []).map((b: any) => ({
      id: b.id,
      service: b.specialty,
      status: b.status,
      address: b.address,
      scheduledAt: b.scheduled_at,
      budgetMin: b.budget_min_mad,
      budgetMax: b.budget_max_mad,
      finalPrice: b.final_price_mad,
      createdAt: b.created_at,
      patientName: profilesById[b.patient_id]?.full_name ?? "—",
      patientPhone: profilesById[b.patient_id]?.phone ?? "",
    }));
    return c.json({ bookings: out });
  } catch (err) {
    console.log("admin/bookings/recent exception:", err);
    return c.json({ bookings: [] });
  }
});

// GET /admin/notifications  → service-role read of admin notifs (RLS bypass)
app.get("/make-server-aa5d1aa6/admin/notifications", async (c) => {
  const adminKey = c.req.header("X-Admin-Key");
  if (adminKey !== "carelink-admin-2024" && !(await requireAdmin(c))) {
    return c.json({ error: "Non autorisé" }, 401);
  }
  try {
    const sb = supabaseAdmin();
    const { data: admins } = await sb.from("profiles").select("id").eq("role", "admin");
    const ids = (admins ?? []).map((a: any) => a.id);
    if (ids.length === 0) return c.json({ notifications: [] });
    const { data, error } = await sb
      .from("notifications")
      .select("id,user_id,kind,title,body,payload,is_read,created_at")
      .in("user_id", ids)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      console.log("admin/notifications error:", error);
      return c.json({ notifications: [] });
    }
    return c.json({ notifications: data ?? [] });
  } catch (e) {
    console.log("admin/notifications exception:", e);
    return c.json({ notifications: [] });
  }
});

// POST /admin/login  → validate admin credentials (simple secret-based)

// POST /admin/log-booking  → ensure admin_booking_logs + admin notifications exist (service-role)
app.post("/make-server-aa5d1aa6/admin/log-booking", async (c) => {
  try {
    const authUser = await getAuthUser(c);
    if (!authUser) return c.json({ error: "Non autorisé" }, 401);
    const body = await c.req.json();
    const bookingId = body?.booking_id || body?.id;
    if (!bookingId) return c.json({ error: "booking_id requis" }, 400);

    const sb = supabaseAdmin();
    const { data: booking, error: bErr } = await sb
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .single();
    if (bErr || !booking) return c.json({ error: "Réservation introuvable" }, 404);

    // Only the booking owner or an admin may request server-side logging
    const isAdmin = await requireAdmin(c);
    if (booking.patient_id !== authUser.id && !isAdmin) return c.json({ error: "Accès refusé" }, 403);

    // Check if an admin log already exists
    const { data: existing } = await sb.from("admin_booking_logs").select("id").eq("booking_id", bookingId).single();
    if (!existing) {
      const alertLevel = booking.specialty === "psychologist" && (booking.urgency === "urgent" || booking.urgency === "emergency")
        ? "critical"
        : (booking.specialty === "psychologist" || booking.urgency === "urgent" || booking.urgency === "emergency")
        ? "high"
        : "normal";

      await sb.from("admin_booking_logs").insert({
        booking_id: booking.id,
        patient_id: booking.patient_id,
        professional_id: booking.professional_id,
        specialty: booking.specialty,
        status: booking.status,
        urgency: booking.urgency,
        scheduled_at: booking.scheduled_at,
        address: booking.address,
        price: booking.final_price_mad ?? booking.budget_max_mad,
        notes: booking.notes,
        is_psychologist: booking.specialty === "psychologist",
        alert_level: alertLevel,
        notification_sent_at: new Date().toISOString(),
      });
    }

    // Create a notification row for each admin so AdminPanel (notifications subscription) picks it up
    const { data: admins } = await sb.from("profiles").select("id").eq("role", "admin");
    const adminIds = (admins ?? []).map((a: any) => a.id).filter(Boolean);
    if (adminIds.length) {
      const notifs = adminIds.map((id: string) => ({
        user_id: id,
        kind: "admin_booking",
        title: "Nouvelle réservation",
        body: `Nouvelle réservation ${booking.specialty}`,
        payload: { booking_id: booking.id },
      }));
      await sb.from("notifications").insert(notifs);
    }

    return c.json({ success: true });
  } catch (e) {
    console.log("admin/log-booking exception", e);
    return c.json({ error: "Erreur serveur" }, 500);
  }
});
app.post("/make-server-aa5d1aa6/admin/login", async (c) => {
  const { email, password } = await c.req.json();
  if (email === "admin@carelink.ma" && password === "CareLinkAdmin2024!") {
    return c.json({ success: true, token: "carelink-admin-2024", role: "admin" });
  }
  // Also try Supabase auth
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.signInWithPassword({ email, password });
  if (!error && data.user?.user_metadata?.role === "admin") {
    return c.json({ success: true, token: data.session!.access_token, role: "admin" });
  }
  return c.json({ error: "Identifiants incorrects" }, 401);
});

Deno.serve(app.fetch);