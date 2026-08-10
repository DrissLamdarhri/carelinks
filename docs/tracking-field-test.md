# Live tracking — field test protocol

Eight scenarios that decide whether tracking is production-ready. Everything
before this was simulated; only these run the real stack against real radios.

**Two devices, one booking.** Patient device (P) and professional device (N).
Both on a dev build, both signed in, payment cleared, N tapped "Je pars".

Record each scenario. A description of what went wrong is far less useful than
ten seconds of screen capture.

---

## Before leaving

| Check | Why |
|---|---|
| Both devices ≥ 80% battery | Scenario 7 measures drain; a low battery changes OS behaviour |
| **Disable battery optimisation for CareLink on N** | Samsung/Xiaomi kill foreground services aggressively. Settings → Apps → CareLink → Battery → Unrestricted |
| Screen brightness fixed on both | Battery comparison is meaningless otherwise |
| `adb shell dumpsys batterystats --reset` with N connected | Baseline for scenario 7 |
| Note the booking UUID | Needed for the security check |

**Known-untested paths.** These have never executed against a real radio, so
look hardest here: private-channel resubscribe after socket loss, the Android
foreground service surviving Doze, and GPS re-acquisition after a genuine tunnel
(simulated dropouts stop the *sender*; they do not drop the *socket*).

---

## 1 · Real outdoor trip

N drives or walks 1–2 km toward P. P watches.

**Pass:** marker stays on the drawn road at maximum zoom, including through
turns. Movement reads as a vehicle, not a slide. Camera holds still, drifts
occasionally, never twitches. ETA falls monotonically without whiplash.

**Fail signals:** marker beside the line; visible stepping; camera lurching;
route redrawing repeatedly.

> Real multipath is not the noise the simulator injects — it is correlated and
> biased for tens of seconds at a time, especially in narrow streets. This is
> the first honest test of the filter and the trust gate.

## 2 · Wrong turn

N deliberately takes a different street, continues 200–300 m, then rejoins.

**Pass:** marker leaves the line and follows reality within ~5 s; the transition
is an ease, never a jump; a replacement route appears within ~4 s of that; the
old route disappears when the new one arrives.

**Fail:** marker glued to the abandoned road; a teleport at divergence; both
routes drawn at once; no re-route at all.

## 3 · GPS loss and recovery

N enters a tunnel, underground car park, or dense building.

**Pass:** marker continues briefly (dead reckoning, up to 5 s), then holds. P
sees the amber stale state and "Position datant de …". On re-acquisition the
marker **animates** to the true position; a hard jump is acceptable only if the
gap is large.

**Fail:** silent freeze with no indication; marker teleports on recovery;
staleness never clears.

## 4 · Background tracking

With N mid-trip: lock the screen for 2 min, then switch to another app for 2 min.

**Pass:** the persistent CareLink notification is visible throughout; P keeps
receiving updates the whole time; no gap on returning to the app.

**Fail:** updates stop within seconds of locking; notification absent; a burst
of queued positions on foregrounding.

> The single largest risk in this list. If it fails, check that battery
> optimisation is actually disabled before concluding the code is wrong.

## 5 · Patient loses network

Aeroplane mode on **P** for 30 s, then off.

**Pass:** P shows stale state; on reconnect the marker resumes at the correct
current position without a long blank; no duplicate markers.

**Fail:** marker stuck at the pre-outage position indefinitely; the screen never
recovers without a manual reload.

> Broadcast is ephemeral — nothing is replayed. Recovery depends on the next
> broadcast arriving and on the **private channel resubscribing with a valid
> JWT**. If the token refreshed during the outage and resubscribe fails, this is
> where it shows.

## 6 · Professional loses network

Aeroplane mode on **N** for 30 s, then off.

**Pass:** P sees stale within ~7 s; N's own map keeps working (GPS is local); on
reconnect P catches up within a couple of seconds.

**Fail:** N's app errors or freezes; P never recovers; positions arrive out of
order and the marker jumps backwards.

## 7 · Long trip — 15–20 minutes

Continuous tracking. Both apps foregrounded for the first 10 min, N locked for
the rest.

**Watch for:** animation degrading over time; the app becoming sluggish; heat;
either device dropping below ~60% battery.

```bash
# with N connected, after the run
adb shell dumpsys batterystats --charged ma.carelink.app > battery-field.txt
grep -A 20 "Estimated power use" battery-field.txt
adb shell dumpsys battery reset      # IMPORTANT — restores normal charging
```

Also run `/dev/bench` on P **before and after** the trip and compare. A drop in
p95 after 20 minutes means something is accumulating.

## 8 · Security — do not skip

Still outstanding from Phase 1, and the only item that blocks launch outright.

Signed in on a **third account** unrelated to the booking:

```js
supabase.channel('tracking:<booking-uuid>:pro', { config: { private: true } })
  .subscribe(s => console.log(s))     // expect CHANNEL_ERROR
```

Then repeat with `private: false`.

**Either one returning `SUBSCRIBED`, or delivering any position, is a launch
blocker** — it means a stranger can stream a nurse's live location.

---

## Reporting

For each: pass / fail, a recording of the interesting ten seconds, and the
device. Failures are more useful than passes — "scenario 4 stopped updating 40 s
after lock, notification still visible" is directly actionable; "background
didn't work" is not.
