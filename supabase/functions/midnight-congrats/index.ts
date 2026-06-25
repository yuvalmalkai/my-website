// Quit Buddy - midnight-congrats
// Meant to be called by a Cron Job every ~10 minutes. At midnight Israel
// time, sends a personal "good job" push to everyone currently still under
// their limit for the smoking day in progress (which started at 7am
// yesterday and runs until 7am today).

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

function israelInfo() {
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
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const calendarDate = `${parts.year}-${parts.month}-${parts.day}`;

  // Smoking day runs 7am -> 7am. At midnight (hour 0) we're still inside
  // the smoking day that started yesterday at 7am.
  let smokingDay = calendarDate;
  if (hour < 7) {
    const d = new Date(`${calendarDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    smokingDay = d.toISOString().slice(0, 10);
  }

  return { hour, minute, calendarDate, smokingDay };
}

Deno.serve(async (_req) => {
  try {
    const { hour, minute, calendarDate, smokingDay } = israelInfo();

    if (hour !== 0 || minute >= 15) {
      return new Response("not midnight window", { status: 200 });
    }

    // Only send once per calendar night.
    const claimRes = await fetch(`${SUPABASE_URL}/rest/v1/midnight_congrats_sent`, {
      method: "POST",
      headers: { ...REST_HEADERS, Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify({ sent_date: calendarDate }),
    });
    const claimed = await claimRes.json();
    if (!Array.isArray(claimed) || claimed.length === 0) {
      return new Response("already sent tonight", { status: 200 });
    }

    const entriesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/daily_entries?entry_date=eq.${smokingDay}&select=user_id,dice_total,manually_exceeded`,
      { headers: REST_HEADERS }
    );
    const entries = await entriesRes.json();

    const logsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/cigarette_logs?entry_date=eq.${smokingDay}&select=user_id`,
      { headers: REST_HEADERS }
    );
    const logs = await logsRes.json();
    const counts: Record<string, number> = {};
    for (const l of logs) counts[l.user_id] = (counts[l.user_id] || 0) + 1;

    const onTrackUserIds = entries
      .filter((e: any) => !e.manually_exceeded && (counts[e.user_id] || 0) <= e.dice_total)
      .map((e: any) => e.user_id);

    if (onTrackUserIds.length === 0) {
      return new Response("nobody currently on track", { status: 200 });
    }

    const subsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=in.(${onTrackUserIds.join(",")})&select=*`,
      { headers: REST_HEADERS }
    );
    const subs = await subsRes.json();

    const payload = JSON.stringify({
      title: "Quit Buddy",
      body: "🎉 Good job, you're amazing!",
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
