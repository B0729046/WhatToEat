import assert from "node:assert/strict";
import test from "node:test";
import {
  findDuplicateRestaurant,
  mealDateConflict,
} from "../api/state-logic.js";
import {
  getDailyItalianLesson,
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
  assert.ok(morning.meaning);
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
