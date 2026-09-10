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
    "\u6295\u7968\u5c07\u65bc\u4eca\u665a\u7d50\u7b97",
  ].join("\n");
}

export async function sendScheduledReminder(phase) {
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
        ? "\u8ddd\u96e2\u901f\u5831\u53ea\u5269 5 \u5206\u9418\uff0c\u5169\u4f4d\u4f9d\u7136\u90fd\u6c92\u6295\u7968\u3002\u4eca\u5929\u662f\u6253\u7b97\u9760\u611b\u60c5\u6b62\u9913\u55ce\uff1f"
        : "\u8ddd\u96e2\u901f\u5831\u53ea\u5269 30 \u5206\u9418\uff0c\u4f60\u5011\u5169\u500b\u90fd\u9084\u6c92\u6295\u7968\u3002";
  } else {
    const absent = missing[0];
    const voted = USERS.find((user) => user !== absent);
    text =
      phase === "final"
        ? `\u8ddd\u96e2\u901f\u5831\u53ea\u5269 5 \u5206\u9418\uff0c${absent}\u4ecd\u672a\u6295\u7968\u3002${voted}\u6b63\u9010\u6f38\u5931\u53bb\u8010\u6027\u3002`
        : `${voted}\u5df2\u7d93\u9078\u597d\u4e86\uff0c${absent}\u4eca\u5929\u662f\u6253\u7b97\u9760\u5149\u5408\u4f5c\u7528\u55ce\uff1f`;
  }
  const directTargets = (
    await Promise.all(missing.map(lineTargetForUser))
  ).filter(Boolean);
  const sent = await pushLineText(text, directTargets);
  return { sent, missing, phase };
}

export async function finalizePreviousDay() {
  const day = taipeiDay(-1);
  const { highestVotes, leaders } = await currentLeaders(day);
  const existing = await redis("HGET", KEYS.meals, day);
  if (existing)
    return { day, winner: JSON.parse(existing), alreadyFinalized: true };
  if (!leaders.length) return { day, winner: null, highestVotes };
  const seed = [...day].reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  const selected = leaders[seed % leaders.length];
  const winner = {
    restaurantId: selected.id,
    name: selected.name,
    createdAt: new Date().toISOString(),
    finalizedBy: "daily-cron",
    votes: highestVotes,
  };
  await redis("HSET", KEYS.meals, day, JSON.stringify(winner));
  return { day, winner, highestVotes, tied: leaders.length };
}

export async function pushLineLeaders() {
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
        "23:59 \u5c07\u81ea\u52d5\u6c7a\u5b9a\u4eca\u65e5\u9910\u5ef3\u3002",
      ].join("\n")
    : "\u{1f37d}\ufe0f 17:30 \u6295\u7968\u901f\u5831\n\u4eca\u5929\u76ee\u524d\u9084\u6c92\u6709\u4eba\u6295\u7968\u3002";
  const leader = leaders[0];
  let comment = "";
  if (leader?.daysSinceEaten != null && leader.daysSinceEaten <= 3)
    comment = `\n\n\u53c8\u662f${leader.name}\uff1f\u5e97\u54e1\u53ef\u80fd\u5df2\u7d93\u5728\u5e6b\u4f60\u5011\u7559\u4f4d\u5b50\u4e86\u3002`;
  else if (leader?.daysSinceEaten >= 30)
    comment = `\n\n${leader.name}\u5df2\u7d93 ${leader.daysSinceEaten} \u5929\u6c92\u88ab\u81e8\u5e78\uff0c\u5b83\u958b\u59cb\u61f7\u7591\u81ea\u5df1\u505a\u932f\u4e86\u4ec0\u9ebc\u3002`;
  await pushLineText(text + comment, targets);
  return {
    day,
    leaders: leaders.map((item) => item.name),
    highestVotes,
    subscribers: targets.length,
  };
}
