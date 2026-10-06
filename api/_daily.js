const REST_URL =
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REST_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const USERS = ["\u5a01\u5a01", "\u5c0f\u8607\u8607"];
const KEYS = {
  restaurants: "whattoeat:restaurants",
  meals: "whattoeat:meals",
  lineSubscribers: "whattoeat:lineSubscribers",
  lineTargetMigrated: "whattoeat:lineTargetMigrated",
  lineIdentities: "whattoeat:lineIdentities",
  lineTargetsByUser: "whattoeat:lineTargetsByUser",
};

export function taipeiDay(offsetDays = 0) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(Date.now() + offsetDays * 86400000));
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
}

export function isTaipeiWeekday() {
  const weekday = new Date(`${taipeiDay()}T00:00:00Z`).getUTCDay();
  return weekday >= 1 && weekday <= 5;
}

export function isTaipeiReportWindow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Taipei",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return (
    !["Sat", "Sun"].includes(value.weekday) &&
    Number(value.hour) === 17 &&
    Number(value.minute) >= 25 &&
    Number(value.minute) <= 45
  );
}

export async function redis(...command) {
  if (!REST_URL || !REST_TOKEN)
    throw new Error(
      "\u5c1a\u672a\u8a2d\u5b9a Upstash Redis \u74b0\u5883\u8b8a\u6578",
    );
  const response = await fetch(
    `${REST_URL}/${command.map((part) => encodeURIComponent(String(part))).join("/")}`,
    { headers: { Authorization: `Bearer ${REST_TOKEN}` } },
  );
  const payload = await response.json();
  if (!response.ok || payload.error)
    throw new Error(payload.error || "Upstash request failed");
  return payload.result;
}

export async function subscribeLineTarget(target) {
  if (!target) throw new Error("Missing LINE target");
  await redis("SADD", KEYS.lineSubscribers, target);
}

export async function unsubscribeLineTarget(target) {
  if (target) await redis("SREM", KEYS.lineSubscribers, target);
}

export async function isLineSubscribed(target) {
  return (
    Boolean(target) &&
    Number(await redis("SISMEMBER", KEYS.lineSubscribers, target)) === 1
  );
}

export async function bindLineIdentity(target, user) {
  if (!target || !USERS.includes(user)) throw new Error("Invalid identity");
  await Promise.all([
    subscribeLineTarget(target),
    redis("HSET", KEYS.lineIdentities, target, user),
    redis("HSET", KEYS.lineTargetsByUser, user, target),
  ]);
}

export async function lineIdentity(target) {
  return target ? await redis("HGET", KEYS.lineIdentities, target) : null;
}

export async function lineTargetForUser(user) {
  return USERS.includes(user)
    ? await redis("HGET", KEYS.lineTargetsByUser, user)
    : null;
}

async function lineTargets() {
  const legacyTarget = process.env.LINE_TARGET_ID;
  const migrated = await redis("GET", KEYS.lineTargetMigrated);
  if (!migrated) {
    if (legacyTarget) await subscribeLineTarget(legacyTarget);
    await redis("SET", KEYS.lineTargetMigrated, "1");
  }
  return (await redis("SMEMBERS", KEYS.lineSubscribers)) || [];
}

export async function subscriberTargets() {
  return await lineTargets();
}

async function sendLineMessage(target, text) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured");
  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: target,
      messages: [{ type: "text", text }],
    }),
  });
  if (!response.ok)
    throw new Error(
      `LINE push failed (${response.status}): ${await response.text()}`,
    );
}

export async function pushLineText(text, targets) {
  const recipients = targets?.length ? targets : await lineTargets();
  const unique = [...new Set(recipients.filter(Boolean))];
  await Promise.all(unique.map((target) => sendLineMessage(target, text)));
  return unique.length;
}

export async function replyLineMessage(replyToken, text) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured");
  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
  });
  if (!response.ok)
    throw new Error(
      `LINE reply failed (${response.status}): ${await response.text()}`,
    );
}

function pairs(values) {
  const result = {};
  for (let index = 0; index < (values || []).length; index += 2)
    result[values[index]] = values[index + 1];
  return result;
}

export function authorizeCron(req) {
  const secret = process.env.CRON_SECRET;
  return Boolean(
    secret &&
      (req.headers.authorization === `Bearer ${secret}` ||
        req.headers["x-cron-secret"] === secret),
  );
}

export function cronAuthDiagnostic(req) {
  const expected = process.env.CRON_SECRET || "";
  const authorization = String(req.headers.authorization || "");
  const received = String(
    req.headers["x-cron-secret"] || authorization.replace(/^Bearer\s+/i, ""),
  );
  return {
    error: "Unauthorized",
    secretConfigured: Boolean(expected),
    expectedLength: expected.length,
    secretReceived: Boolean(received),
    receivedLength: received.length,
  };
}

export async function currentLeaders(day = taipeiDay()) {
  const [rawRestaurants, ...rawVotes] = await Promise.all([
    redis("HGETALL", KEYS.restaurants),
    ...USERS.map((user) => redis("SMEMBERS", `whattoeat:votes:${day}:${user}`)),
  ]);
  const voteSets = rawVotes.map((votes) => new Set(votes || []));
  const rawMeals = await redis("HGETALL", KEYS.meals);
  const meals = Object.entries(pairs(rawMeals))
    .map(([date, value]) => ({ ...JSON.parse(value), date }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const lastMealByRestaurant = new Map();
  for (const meal of meals)
    if (!lastMealByRestaurant.has(meal.restaurantId))
      lastMealByRestaurant.set(meal.restaurantId, meal);
  const dayTime = Date.parse(`${day}T00:00:00Z`);
  const restaurants = Object.values(pairs(rawRestaurants))
    .map(JSON.parse)
    .map((restaurant) => ({
      ...restaurant,
      voters: USERS.filter((_, index) => voteSets[index].has(restaurant.id)),
    }))
    .map((restaurant) => ({
      ...restaurant,
      votes: restaurant.voters.length,
      daysSinceEaten: lastMealByRestaurant.has(restaurant.id)
        ? Math.round(
            (dayTime -
              Date.parse(
                `${lastMealByRestaurant.get(restaurant.id).date}T00:00:00Z`,
              )) /
              86400000,
          )
        : null,
    }))
    .sort(
      (a, b) => b.votes - a.votes || a.name.localeCompare(b.name, "zh-Hant"),
    );
  const highestVotes = restaurants[0]?.votes || 0;
  return {
    day,
    highestVotes,
    leaders:
      highestVotes > 0
        ? restaurants.filter((item) => item.votes === highestVotes)
        : [],
    restaurants,
  };
}

export async function todayVoteStatus() {
  const state = await currentLeaders();
  const counts = Object.fromEntries(
    USERS.map((user) => [
      user,
      state.restaurants.filter((item) => item.voters.includes(user)).length,
    ]),
  );
  const common = state.restaurants.filter(
    (item) => item.voters.length === USERS.length,
  ).length;
  return { ...state, counts, common };
}

export function battleText(status) {
  const leaders = status.leaders.length
    ? status.leaders.map((item) => item.name).join("\u3001")
    : "\u5c1a\u7121";
  return [
    `\u4eca\u65e5\u9818\u5148\uff1a${leaders}`,
    `\u5a01\u5a01\u6295\u4e86 ${status.counts["\u5a01\u5a01"]} \u9593\uff0c\u5c0f\u8607\u8607\u6295\u4e86 ${status.counts["\u5c0f\u8607\u8607"]} \u9593`,
    `\u76ee\u524d\u6709 ${status.common} \u9593\u5171\u540c\u9078\u64c7`,
    "\u7528\u9910\u7d00\u9304\u53ef\u5728\u7db2\u7ad9\u624b\u52d5\u65b0\u589e",
  ].join("\n");
}

export async function sendScheduledReminder(phase) {
  if (!isTaipeiWeekday()) return { skipped: true, reason: "weekend" };
  const status = await todayVoteStatus();
  const missing = USERS.filter((user) => status.counts[user] === 0);
  if (!missing.length) return { skipped: true, reason: "everyone-voted" };
  const marker = `whattoeat:reminder:${status.day}:${phase}`;
  const firstRun = await redis("SET", marker, "1", "NX", "EX", 172800);
  if (firstRun !== "OK") return { skipped: true, reason: "already-sent" };
  let text;
  if (missing.length === USERS.length) {
    text =
      phase === "final"
        ? "距離投票速報只剩 5 分鐘，威威和小蘇蘇今天都還沒投票，記得選擇想吃的餐廳。"
        : "距離投票速報還有 30 分鐘，威威和小蘇蘇今天都還沒投票。";
  } else {
    const absent = missing[0];
    const voted = USERS.find((user) => user !== absent);
    text =
      phase === "final"
        ? `距離投票速報只剩 5 分鐘，${absent}今天尚未投票，記得選擇想吃的餐廳。`
        : `${voted}已經完成投票，${absent}有空時也請選擇今天想吃的餐廳。`;
  }
  const directTargets = (
    await Promise.all(missing.map(lineTargetForUser))
  ).filter(Boolean);
  const sent = await pushLineText(text, directTargets);
  return { sent, missing, phase };
}

export async function pushLineLeaders() {
  if (!isTaipeiReportWindow())
    return { skipped: true, reason: "outside-17:30-window" };
  const targets = await lineTargets();
  if (!targets.length)
    return { skipped: true, reason: "no-subscribers", subscribers: 0 };
  const { day, highestVotes, leaders } = await currentLeaders();
  const text = leaders.length
    ? [
        "\u{1f37d}\ufe0f 17:30 \u6295\u7968\u901f\u5831",
        ...leaders.map(
          (item, index) =>
            `${index + 1}. ${item.name}\uff08${highestVotes} \u7968\uff1a${item.voters.join("\u3001")}\uff09`,
        ),
        "",
        "\u524d\u5f80\u6295\u7968\uff1ahttps://what-to-eat-chi-pink.vercel.app/",
      ].join("\n")
    : "\u{1f37d}\ufe0f 17:30 \u6295\u7968\u901f\u5831\n\u4eca\u5929\u76ee\u524d\u9084\u6c92\u6709\u4eba\u6295\u7968\u3002\n\u524d\u5f80\u6295\u7968\uff1ahttps://what-to-eat-chi-pink.vercel.app/";
  const leader = leaders[0];
  let comment = "";
  if (leader?.daysSinceEaten != null && leader.daysSinceEaten <= 3)
    comment = `\n\n${leader.name}最近 ${leader.daysSinceEaten} 天內吃過。`;
  else if (leader?.daysSinceEaten >= 30)
    comment = `\n\n${leader.name}已經 ${leader.daysSinceEaten} 天沒吃了。`;
  await pushLineText(text + comment, targets);
  return {
    day,
    leaders: leaders.map((item) => item.name),
    highestVotes,
    subscribers: targets.length,
  };
}
