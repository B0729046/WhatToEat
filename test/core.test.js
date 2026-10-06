import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { generateAiReply } from "../api/_ai.js";
import finalizeHandler from "../api/finalize.js";
import lineWebhookHandler from "../api/line-webhook.js";
import { isTaipeiReportWindow } from "../api/_daily.js";
import {
  findDuplicateRestaurant,
  mealDateConflict,
} from "../api/state-logic.js";
import {
  getDailyItalianLesson,
  isZhongheRestaurant,
  rankRestaurants,
  selectableRestaurants,
} from "../src/selection.js";

const restaurants = [
  {
    id: "a",
    name: "甲",
    votes: 2,
    voters: ["威威", "小蘇蘇"],
    area: "中山區",
    price: 300,
    categories: ["日式"],
  },
  {
    id: "b",
    name: "乙",
    votes: 2,
    voters: ["威威", "小蘇蘇"],
    area: "中山區",
    price: 200,
    categories: ["台式"],
  },
  {
    id: "c",
    name: "丙",
    votes: 1,
    voters: ["威威"],
    area: "信義區",
    price: 150,
    categories: ["台式"],
  },
  {
    id: "d",
    name: "丁",
    votes: 0,
    voters: [],
    area: "信義區",
    price: null,
    categories: ["其他"],
  },
];

test("排名支援並列，零票不顯示名次", () => {
  assert.deepEqual(rankRestaurants(restaurants), [1, 1, 3, null]);
  assert.deepEqual(
    rankRestaurants(restaurants.map((item) => ({ ...item, votes: 0 }))),
    [null, null, null, null],
  );
});

test("抽選範圍會與既有篩選共同套用", () => {
  const filters = { category: "台式", area: "不限" };
  assert.deepEqual(
    selectableRestaurants(restaurants, filters, "all", "不限").map(
      (item) => item.id,
    ),
    ["b", "c"],
  );
  assert.deepEqual(
    selectableRestaurants(restaurants, filters, "voted", "不限").map(
      (item) => item.id,
    ),
    ["b", "c"],
  );
  assert.deepEqual(
    selectableRestaurants(restaurants, filters, "mutual", "不限").map(
      (item) => item.id,
    ),
    ["b"],
  );
});

test("每日義大利文在同一個台北日期會保持一致", () => {
  const morning = getDailyItalianLesson(new Date("2026-09-16T01:00:00+08:00"));
  const evening = getDailyItalianLesson(new Date("2026-09-16T23:00:00+08:00"));
  assert.deepEqual(morning, evening);
  assert.ok(morning.italian);
  assert.ok(morning.pronunciation);
  assert.ok(morning.examplePronunciation);
  assert.ok(morning.meaning);
});

test("中窩美食依地區自動收錄且不改動原清單", () => {
  const input = [
    { id: "z1", area: "新北市中和區" },
    { id: "z2", area: "中和" },
    { id: "t1", area: "台北市中山區" },
  ];
  assert.deepEqual(
    input.filter(isZhongheRestaurant).map((item) => item.id),
    ["z1", "z2"],
  );
  assert.equal(input.length, 3);
});

test("可偵測標準化 Maps URL 與名稱地區重複", () => {
  const existing = [
    {
      name: "十巷 咖哩",
      area: "中山區",
      mapUrl: "https://maps.app.goo.gl/abc?utm_source=x",
    },
  ];
  assert.ok(
    findDuplicateRestaurant(existing, {
      name: "不同名稱",
      area: "別區",
      mapUrl: "https://maps.app.goo.gl/abc",
    }),
  );
  assert.ok(
    findDuplicateRestaurant(existing, {
      name: "十巷咖哩",
      area: "中山區",
      mapUrl: "https://google.com/maps/place/other",
    }),
  );
});

test("用餐紀錄換到已有資料的日期視為衝突", () => {
  const records = { "2026-09-14": {}, "2026-09-15": {} };
  assert.equal(mealDateConflict(records, "2026-09-14", "2026-09-15"), true);
  assert.equal(mealDateConflict(records, "2026-09-14", "2026-09-14"), false);
});

test("Gemini 回應請求與文字解析正常", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";
  globalThis.fetch = async (url, options) => {
    assert.match(String(url), /:generateContent$/);
    const body = JSON.parse(options.body);
    assert.equal(body.contents[0].parts[0].text, "今天吃什麼？");
    return new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: "小葉葉測試回覆" }] } }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  try {
    assert.equal(
      await generateAiReply("今天吃什麼？", "小蘇蘇"),
      "小葉葉測試回覆",
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
});

test("LINE Webhook 可驗證簽章並接受空事件", async () => {
  const originalSecret = process.env.LINE_CHANNEL_SECRET;
  process.env.LINE_CHANNEL_SECRET = "test-line-secret";
  const rawBody = JSON.stringify({ events: [] });
  const signature = createHmac("sha256", process.env.LINE_CHANNEL_SECRET)
    .update(rawBody)
    .digest("base64");
  let statusCode = 0;
  let responseBody;
  const response = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return body;
    },
  };
  try {
    await lineWebhookHandler(
      {
        method: "POST",
        body: rawBody,
        headers: { "x-line-signature": signature },
      },
      response,
    );
    assert.equal(statusCode, 200);
    assert.deepEqual(responseBody, { ok: true });
  } finally {
    if (originalSecret === undefined) delete process.env.LINE_CHANNEL_SECRET;
    else process.env.LINE_CHANNEL_SECRET = originalSecret;
  }
});

test("舊結算端點不再寫入用餐紀錄", async () => {
  const originalSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "test-cron-secret";
  let statusCode = 0;
  let responseBody;
  const response = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return body;
    },
  };
  try {
    await finalizeHandler(
      {
        method: "GET",
        headers: { authorization: "Bearer test-cron-secret" },
      },
      response,
    );
    assert.equal(statusCode, 200);
    assert.deepEqual(responseBody, {
      skipped: true,
      reason: "meal-history-is-manual-only",
    });
  } finally {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  }
});

test("LINE 速報只允許平日台北時間 17:30 左右發送", () => {
  assert.equal(
    isTaipeiReportWindow(new Date("2026-10-06T17:30:00+08:00")),
    true,
  );
  assert.equal(
    isTaipeiReportWindow(new Date("2026-10-06T17:00:00+08:00")),
    false,
  );
  assert.equal(
    isTaipeiReportWindow(new Date("2026-10-07T00:30:00+08:00")),
    false,
  );
  assert.equal(
    isTaipeiReportWindow(new Date("2026-10-10T17:30:00+08:00")),
    false,
  );
});
