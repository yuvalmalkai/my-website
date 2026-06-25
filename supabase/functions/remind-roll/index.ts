// Quit Buddy - remind-roll
// Meant to be called by a Cron Job every ~10 minutes. Checks whether it's
// currently 8pm in Israel (DST-safe, since it checks real Israel wall-clock
// time rather than a fixed UTC hour), and if so, sends a "let's roll" push
// to everyone - but only once per day, even if the cron fires more than
// once inside that window.

// @ts-ignore - npm specifier, resolved by the Deno/Supabase edge runtime
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:example@example.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const REST_HEADERS = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

function israelNow() {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return {
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    dateStr: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

Deno.serve(async (_req) => {
  try {
    const { hour, minute, dateStr } = israelNow();

    // Only act inside the 20:00-20:15 Israel-time window.
    if (hour !== 20 || minute >= 15) {
      return new Response("not reminder time", { status: 200 });
    }

    // Try to claim today - if a row already exists, this returns nothing
    // and we know it's already been sent today.
    const claimRes = await fetch(`${SUPABASE_URL}/rest/v1/roll_reminders_sent`, {
      method: "POST",
      headers: { ...REST_HEADERS, Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify({ reminder_date: dateStr }),
    });
    const claimed = await claimRes.json();
    if (!Array.isArray(claimed) || claimed.length === 0) {
      return new Response("already sent today", { status: 200 });
    }

    const subsRes = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?select=*`, {
      headers: REST_HEADERS,
    });
    const subs = await subsRes.json();

    const payload = JSON.stringify({
      title: "Quit Buddy",
      body: "🎲 It's 8pm - let's roll the dice for tomorrow!",
    });

    await Promise.all(
      subs.map(async (sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
        } catch (err: any) {
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${sub.id}`, {
              method: "DELETE",
              headers: REST_HEADERS,
            });
          } else {
            console.error("push send error", err);
          }
        }
      })
    );

    return new Response("sent", { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response("error", { status: 500 });
  }
});
