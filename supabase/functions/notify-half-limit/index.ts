// Quit Buddy - notify-half-limit
// Triggered by a Database Webhook every time a row is inserted into cigarette_logs.
// Checks whether this cigarette is the one that crosses HALF of that user's
// allowance for the day, and if so, pushes a notification to everyone else.

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

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record;
    const userId = record.user_id;
    const entryDate = record.entry_date;

    // How many cigarettes are allowed today for this user?
    const entryRes = await fetch(
      `${SUPABASE_URL}/rest/v1/daily_entries?user_id=eq.${userId}&entry_date=eq.${entryDate}&select=dice_total`,
      { headers: REST_HEADERS }
    );
    const entries = await entryRes.json();
    if (!entries.length) {
      return new Response("no allowance set, skipping", { status: 200 });
    }
    const diceTotal = entries[0].dice_total;

    // How many have they logged today, including this one?
    const countRes = await fetch(
      `${SUPABASE_URL}/rest/v1/cigarette_logs?user_id=eq.${userId}&entry_date=eq.${entryDate}&select=id`,
      { headers: { ...REST_HEADERS, Prefer: "count=exact" } }
    );
    const countHeader = countRes.headers.get("content-range");
    const count = countHeader
      ? parseInt(countHeader.split("/")[1], 10)
      : (await countRes.json()).length;

    const half = Math.ceil(diceTotal / 2);

    // Only fire exactly at the moment they cross the halfway point.
    if (count !== half) {
      return new Response("not the half-limit moment, skipping", { status: 200 });
    }

    // Who is this?
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=username`,
      { headers: REST_HEADERS }
    );
    const profiles = await profileRes.json();
    const username = profiles[0]?.username || "Someone";

    // Everyone else's push subscriptions.
    const subsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=neq.${userId}&select=*`,
      { headers: REST_HEADERS }
    );
    const subs = await subsRes.json();

    const notificationPayload = JSON.stringify({
      title: "Quit Buddy",
      body: `${username} just hit half their limit for today (${half}/${diceTotal}) 😬`,
    });

    await Promise.all(
      subs.map(async (sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            notificationPayload
          );
        } catch (err: any) {
          // 404/410 means the subscription is dead (uninstalled, expired) - clean it up.
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

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response("error", { status: 500 });
  }
});
