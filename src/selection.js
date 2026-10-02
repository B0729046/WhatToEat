export const DRAW_SCOPES = {
  all: "全部候選",
  voted: "至少一人投票",
  mutual: "兩人共同投票",
};

const ITALIAN_LESSONS = [
  {
    chinese: "吃",
    italian: "mangiare",
    pronunciation: "曼賈雷",
    example: "Mangiamo!",
    examplePronunciation: "曼賈莫",
    meaning: "我們吃吧！",
  },
  {
    chinese: "我餓了",
    italian: "Ho fame",
    pronunciation: "歐 法梅",
    example: "Ho fame.",
    examplePronunciation: "歐 法梅",
    meaning: "我餓了。",
  },
  {
    chinese: "好吃",
    italian: "buono",
    pronunciation: "波喔諾",
    example: "È buono!",
    examplePronunciation: "欸 波喔諾",
    meaning: "真好吃！",
  },
  {
    chinese: "晚餐",
    italian: "la cena",
    pronunciation: "拉 切納",
    example: "La cena è pronta.",
    examplePronunciation: "拉 切納 欸 普隆塔",
    meaning: "晚餐準備好了。",
  },
  {
    chinese: "請",
    italian: "per favore",
    pronunciation: "佩爾 法沃雷",
    example: "Il menù, per favore.",
    examplePronunciation: "伊爾 梅努 佩爾 法沃雷",
    meaning: "請給我菜單。",
  },
  {
    chinese: "謝謝",
    italian: "grazie",
    pronunciation: "葛拉茲耶",
    example: "Grazie mille!",
    examplePronunciation: "葛拉茲耶 米勒",
    meaning: "非常謝謝！",
  },
  {
    chinese: "乾杯",
    italian: "cin cin",
    pronunciation: "親 親",
    example: "Cin cin!",
    examplePronunciation: "親 親",
    meaning: "乾杯！",
  },
];

export function getDailyItalianLesson(date = new Date()) {
  const dateKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const dayNumber = Math.floor(Date.parse(`${dateKey}T00:00:00Z`) / 86400000);
  return ITALIAN_LESSONS[dayNumber % ITALIAN_LESSONS.length];
}

export function rankRestaurants(restaurants) {
  let previousVotes = null;
  let previousRank = null;
  return restaurants.map((restaurant, index) => {
    if (!restaurant.votes) return null;
    if (restaurant.votes === previousVotes) return previousRank;
    previousVotes = restaurant.votes;
    previousRank = index + 1;
    return previousRank;
  });
}

export function selectableRestaurants(restaurants, filters, scope, allValue) {
  return restaurants.filter((restaurant) => {
    const voters = restaurant.voters || [];
    const scopeMatches =
      scope === "mutual"
        ? voters.length === 2
        : scope === "voted"
          ? voters.length >= 1
          : true;
    return (
      scopeMatches &&
      (filters.category === allValue ||
        (restaurant.categories || [restaurant.category]).includes(
          filters.category,
        )) &&
      (filters.area === allValue || restaurant.area === filters.area)
    );
  });
}

export function isZhongheRestaurant(restaurant) {
  return /(?:新北市)?中和區|中和/.test(String(restaurant?.area || ""));
}
