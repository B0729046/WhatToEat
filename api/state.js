const REST_URL =
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REST_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const KEYS = {
  restaurants: "whattoeat:restaurants",
  votes: "whattoeat:votes",
  history: "whattoeat:history",
  meals: "whattoeat:meals",
};
const USERS = ["威威", "小蘇蘇"];
function taipeiDay() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
}
const voteKey = (user) => `whattoeat:votes:${taipeiDay()}:${user}`;
const historyKey = () => `whattoeat:history:${taipeiDay()}`;
function send(res, status, body) {
  res
    .status(status)
    .setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}
async function redis(...command) {
  if (!REST_URL || !REST_TOKEN)
    throw new Error("尚未設定 Upstash Redis 環境變數");
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
  for (let i = 0; i < (values || []).length; i += 2)
    result[values[i]] = values[i + 1];
  return result;
}
function googleMapsUrl(value) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    throw new Error("Google Maps 連結格式不正確");
  }
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    !(
      host === "maps.app.goo.gl" ||
      host === "goo.gl" ||
      host === "google.com" ||
      host.endsWith(".google.com")
    )
  )
    throw new Error("請使用 Google Maps 的 HTTPS 連結");
  return url;
}
function cleanPlaceName(value) {
  const original = String(value || "").trim();
  const withoutAddress = original.replace(
    /^\d{3,5}\s*[^號]{2,100}號(?:之\d+)?(?:\s*\d+樓)?\s*/,
    "",
  );
  return withoutAddress || original;
}
function inferArea(value) {
  const text = String(value || "");
  const verified = { 十巷咖哩: "中山區", 今大魯肉飯: "三重區" };
  return (
    text.match(/(?:縣|市)([^縣市]{1,6}(?:區|鄉|鎮|市))/)?.[1] ||
    verified[cleanPlaceName(text)] ||
    "未設定"
  );
}
function inferCategory(name) {
  const rules = [
    [/壽司|寿司|鮨|拉麵|丼|咖哩|居酒屋|燒鳥/, "日式"],
    [/魯肉|滷肉|雞肉飯|牛肉麵|小吃|麵線|湯包/, "台式"],
    [/義麵|義大利|披薩|Pizza/i, "義式"],
    [/韓式|韓國|泡菜|部隊鍋/, "韓式"],
    [/泰式|泰國|打拋|河粉|越南/, "東南亞"],
    [/火鍋|涮涮鍋|麻辣鍋/, "鍋物"],
    [/咖啡|Cafe|Café/i, "咖啡廳"],
    [/早餐|吐司|蛋餅/, "早餐"],
    [/燒肉|烤肉/, "燒肉"],
  ];
  return rules.find(([pattern]) => pattern.test(name))?.[1] || "餐廳";
}
function estimatePrice(category) {
  return (
    {
      台式: 150,
      早餐: 120,
      日式: 350,
      義式: 350,
      韓式: 350,
      東南亞: 250,
      鍋物: 500,
      燒肉: 600,
      咖啡廳: 250,
    }[category] || 300
  );
}
async function areaFromCoordinates(html) {
  const coordinates = [
    ...html.matchAll(/(\d{2,3}\.\d{4,}),\s*(\d{2}\.\d{4,})/g),
  ]
    .map((match) => [Number(match[1]), Number(match[2])])
    .find(
      ([longitude, latitude]) =>
        longitude >= 119 &&
        longitude <= 123 &&
        latitude >= 21 &&
        latitude <= 26,
    );
  if (!coordinates) return "未設定";
  const [longitude, latitude] = coordinates;
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=zh-TW`,
      {
        headers: {
          "User-Agent":
            "WhatToEat/1.0 (https://what-to-eat-chi-pink.vercel.app)",
        },
      },
    );
    const data = await response.json();
    return (
      data.address?.city_district ||
      data.address?.suburb ||
      data.address?.town ||
      data.address?.county ||
      "未設定"
    );
  } catch {
    return "未設定";
  }
}
async function areaFromName(name) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=tw&limit=1&q=${encodeURIComponent(name)}&accept-language=zh-TW`,
      {
        headers: {
          "User-Agent":
            "WhatToEat/1.0 (https://what-to-eat-chi-pink.vercel.app)",
        },
      },
    );
    const [place] = await response.json();
    return (
      place?.address?.city_district ||
      place?.address?.suburb ||
      place?.address?.town ||
      place?.display_name?.match(/([^,，]{1,6}(?:區|鄉|鎮|市))[,，]/)?.[1] ||
      "未設定"
    );
  } catch {
    return "未設定";
  }
}
async function restaurantFromGoogleMaps(mapUrl) {
  const original = googleMapsUrl(mapUrl);
  const response = await fetch(original, {
    redirect: "follow",
    headers: { "User-Agent": "Mozilla/5.0 WhatToEat/1.0" },
  });
  googleMapsUrl(response.url);
  const html = await response.text();
  const metaTag = html.match(
    /<meta[^>]+(?:property|name)=["']og:title["'][^>]*>/i,
  )?.[0];
  let rawName = metaTag?.match(/content=["']([^"']+)/i)?.[1];
  if (!rawName) rawName = response.url.match(/\/maps\/place\/([^/]+)/)?.[1];
  if (rawName) rawName = decodeURIComponent(rawName.replace(/\+/g, " "));
  const name = cleanPlaceName(
    rawName?.replace(/&amp;/g, "&").replace(/\s*[-–]\s*Google Maps.*$/i, ""),
  );
  if (!response.ok || !name || name === "Google Maps")
    throw new Error("無法從這個連結取得餐廳名稱，請改用下方手動新增");
  const category = inferCategory(name);
  const addressArea = inferArea(rawName);
  const coordinateArea =
    addressArea === "未設定" ? await areaFromCoordinates(html) : addressArea;
  return cleanRestaurant({
    name,
    mapUrl: original.toString(),
    category,
    area:
      coordinateArea === "未設定" ? await areaFromName(name) : coordinateArea,
    price: estimatePrice(category),
    priceEstimated: true,
    meal: ["早餐", "午餐", "晚餐", "宵夜"],
  });
}
async function getState() {
  const [rawRestaurants, weiVotes, suVotes, rawHistory, rawMeals] =
    await Promise.all([
      redis("HGETALL", KEYS.restaurants),
      redis("SMEMBERS", voteKey("威威")),
      redis("SMEMBERS", voteKey("小蘇蘇")),
      redis("LRANGE", historyKey(), 0, 49),
      redis("HGETALL", KEYS.meals),
    ]);
  const selections = {
    威威: new Set(weiVotes || []),
    小蘇蘇: new Set(suVotes || []),
  };
  const diningHistory = Object.entries(pairs(rawMeals))
    .map(([date, value]) => ({ ...JSON.parse(value), date }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const lastMealByRestaurant = new Map();
  for (const meal of diningHistory)
    if (!lastMealByRestaurant.has(meal.restaurantId))
      lastMealByRestaurant.set(meal.restaurantId, meal);
  const todayTime = Date.parse(`${taipeiDay()}T00:00:00Z`);
  const storedRestaurants = Object.values(pairs(rawRestaurants)).map(
    JSON.parse,
  );
  const enrichedRestaurants = await Promise.all(
    storedRestaurants.map(async (item) => {
      if (item.enrichmentVersion === 3 || !item.mapUrl) return item;
      let updated = {
        ...item,
        enrichedAt: new Date().toISOString(),
        enrichmentVersion: 3,
      };
      try {
        const details = await restaurantFromGoogleMaps(item.mapUrl);
        updated = {
          ...updated,
          name: details.name,
          category: details.category,
          area: details.area,
          price: details.price,
          priceEstimated: details.priceEstimated,
        };
      } catch (error) {
        console.warn(`Unable to enrich ${item.name}:`, error.message);
      }
      await redis("HSET", KEYS.restaurants, item.id, JSON.stringify(updated));
      return updated;
    }),
  );
  const restaurants = enrichedRestaurants
    .map((item) => {
      const voters = USERS.filter((user) => selections[user].has(item.id));
      const name = cleanPlaceName(item.name);
      const category =
        item.category === "未分類" ? inferCategory(name) : item.category;
      const categories = item.categories?.length ? item.categories : [category];
      const lastMeal = lastMealByRestaurant.get(item.id);
      return {
        ...item,
        name,
        category,
        categories,
        area: item.area === "未設定" ? inferArea(item.name) : item.area,
        price:
          item.price == null || item.price === 0
            ? estimatePrice(category)
            : item.price,
        priceEstimated: item.priceEstimated ?? true,
        voters,
        votes: voters.length,
        lastEatenDate: lastMeal?.date || null,
        daysSinceEaten: lastMeal
          ? Math.round(
              (todayTime - Date.parse(`${lastMeal.date}T00:00:00Z`)) / 86400000,
            )
          : null,
      };
    })
    .sort(
      (a, b) => b.votes - a.votes || a.name.localeCompare(b.name, "zh-Hant"),
    );
  return {
    restaurants,
    history: (rawHistory || [])
      .map(JSON.parse)
      .map((item) => ({ ...item, name: cleanPlaceName(item.name) })),
    diningHistory,
  };
}
function cleanRestaurant(body) {
  const name = String(body.name || "")
      .trim()
      .slice(0, 80),
    category = String(body.category || "")
      .trim()
      .slice(0, 30),
    area = String(body.area || "")
      .trim()
      .slice(0, 30),
    price = body.price == null || body.price === "" ? null : Number(body.price),
    mapUrl = String(body.mapUrl || "")
      .trim()
      .slice(0, 500);
  const meal = [
    ...new Set(
      (Array.isArray(body.meal) ? body.meal : []).map(String).filter(Boolean),
    ),
  ];
  if (
    !name ||
    !category ||
    !area ||
    (price !== null && (!Number.isFinite(price) || price < 0)) ||
    !meal.length
  )
    throw new Error("餐廳資料不完整");
  if (mapUrl) googleMapsUrl(mapUrl);
  return {
    id: crypto.randomUUID(),
    name,
    category,
    area,
    price: price === null ? null : Math.round(price),
    priceEstimated: Boolean(body.priceEstimated),
    meal,
    mapUrl,
    createdAt: new Date().toISOString(),
  };
}
export default async function handler(req, res) {
  try {
    if (req.method === "GET") return send(res, 200, await getState());
    if (req.method !== "POST")
      return send(res, 405, { error: "Method not allowed" });
    const body = req.body || {};
    if (body.action === "addFromMapUrl") {
      const restaurant = await restaurantFromGoogleMaps(body.mapUrl);
      await redis(
        "HSET",
        KEYS.restaurants,
        restaurant.id,
        JSON.stringify(restaurant),
      );
      return send(res, 201, { restaurant });
    }
    if (body.action === "deleteMeal") {
      const date = String(body.date || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
        return send(res, 400, { error: "用餐日期格式不正確" });
      await redis("HDEL", KEYS.meals, date);
      return send(res, 200, { ok: true });
    }
    if (body.action === "updateMeal") {
      const date = String(body.date || "");
      const newDate = String(body.newDate || "");
      const restaurantId = String(body.restaurantId || "");
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(newDate)
      )
        return send(res, 400, { error: "用餐日期格式不正確" });
      const mealRestaurantRaw = await redis(
        "HGET",
        KEYS.restaurants,
        restaurantId,
      );
      if (!mealRestaurantRaw)
        return send(res, 404, { error: "找不到這間餐廳" });
      const mealRestaurant = JSON.parse(mealRestaurantRaw);
      const record = {
        restaurantId,
        name: cleanPlaceName(mealRestaurant.name),
        createdAt: new Date().toISOString(),
      };
      if (date !== newDate) await redis("HDEL", KEYS.meals, date);
      await redis("HSET", KEYS.meals, newDate, JSON.stringify(record));
      return send(res, 200, { ...record, date: newDate });
    }
    const id = String(body.id || "");
    if (!id) return send(res, 400, { error: "缺少餐廳 ID" });
    const raw = await redis("HGET", KEYS.restaurants, id);
    if (!raw) return send(res, 404, { error: "找不到這間餐廳" });
    const restaurant = JSON.parse(raw);
    if (body.action === "update") {
      const categories = [
        ...new Set(
          (Array.isArray(body.categories) ? body.categories : [])
            .map((item) => String(item).trim())
            .filter(Boolean),
        ),
      ].slice(0, 8);
      const price = Number(body.price);
      if (!categories.length || !Number.isFinite(price) || price < 0)
        return send(res, 400, { error: "請至少選一個分類並輸入正確價錢" });
      const updated = {
        ...restaurant,
        categories,
        category: categories[0],
        price: Math.round(price),
        priceEstimated: false,
        updatedAt: new Date().toISOString(),
      };
      await redis("HSET", KEYS.restaurants, id, JSON.stringify(updated));
      return send(res, 200, { restaurant: updated });
    }
    if (body.action === "eat") {
      const date = taipeiDay();
      const record = {
        restaurantId: id,
        name: cleanPlaceName(restaurant.name),
        createdAt: new Date().toISOString(),
      };
      await redis("HSET", KEYS.meals, date, JSON.stringify(record));
      return send(res, 200, { ...record, date });
    }
    if (body.action === "delete") {
      await Promise.all([
        redis("HDEL", KEYS.restaurants, id),
        redis("HDEL", KEYS.votes, id),
        ...USERS.map((user) => redis("SREM", voteKey(user), id)),
      ]);
      return send(res, 200, { ok: true });
    }
    if (body.action === "vote") {
      const voter = String(body.voter || "");
      if (!USERS.includes(voter))
        return send(res, 400, { error: "請選擇威威或小蘇蘇" });
      const wasSelected =
        Number(await redis("SISMEMBER", voteKey(voter), id)) === 1;
      await redis(wasSelected ? "SREM" : "SADD", voteKey(voter), id);
      const record = {
        id: crypto.randomUUID(),
        restaurantId: id,
        name: restaurant.name,
        voter,
        action: wasSelected ? "remove" : "add",
        createdAt: new Date().toISOString(),
      };
      await redis("LPUSH", historyKey(), JSON.stringify(record));
      await redis("LTRIM", historyKey(), 0, 49);
      await Promise.all([
        redis("EXPIRE", historyKey(), 259200),
        redis("EXPIRE", voteKey(voter), 259200),
      ]);
      const state = await getState();
      const winner = state.restaurants.find((item) => item.votes > 0);
      let todayChoice = null;
      if (winner) {
        todayChoice = {
          restaurantId: winner.id,
          name: cleanPlaceName(winner.name),
          createdAt: new Date().toISOString(),
        };
        await redis(
          "HSET",
          KEYS.meals,
          taipeiDay(),
          JSON.stringify(todayChoice),
        );
      } else {
        await redis("HDEL", KEYS.meals, taipeiDay());
      }
      return send(res, 200, {
        selected: !wasSelected,
        record,
        todayChoice,
      });
    }
    return send(res, 400, { error: "不支援的操作" });
  } catch (error) {
    console.error(error);
    return send(res, error.message.includes("環境變數") ? 503 : 400, {
      error: error.message || "伺服器發生錯誤",
    });
  }
}
