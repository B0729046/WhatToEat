const REST_URL =
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REST_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const USERS = ["\u5a01\u5a01", "\u5c0f\u8607\u8607"];
const KEYS = {
  restaurants: "whattoeat:restaurants",
  meals: "whattoeat:meals",
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

async function redis(...command) {
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

function pairs(values) {
  const result = {};
  for (let index = 0; index < (values || []).length; index += 2)
    result[values[index]] = values[index + 1];
  return result;
}

export function authorizeCron(req) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && req.headers.authorization === `Bearer ${secret}`);
}

export async function currentLeaders(day = taipeiDay()) {
  const [rawRestaurants, ...rawVotes] = await Promise.all([
    redis("HGETALL", KEYS.restaurants),
    ...USERS.map((user) => redis("SMEMBERS", `whattoeat:votes:${day}:${user}`)),
  ]);
  const voteSets = rawVotes.map((votes) => new Set(votes || []));
  const restaurants = Object.values(pairs(rawRestaurants))
    .map(JSON.parse)
    .map((restaurant) => ({
      ...restaurant,
      voters: USERS.filter((_, index) => voteSets[index].has(restaurant.id)),
    }))
    .map((restaurant) => ({
      ...restaurant,
      votes: restaurant.voters.length,
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
  };
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
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const target = process.env.LINE_TARGET_ID;
  if (!token || !target)
    throw new Error(
      "\u5c1a\u672a\u8a2d\u5b9a LINE_CHANNEL_ACCESS_TOKEN \u6216 LINE_TARGET_ID",
    );
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
  return {
    day,
    leaders: leaders.map((item) => item.name),
    highestVotes,
  };
}
