export const DRAW_SCOPES = {
  all: "全部候選",
  voted: "至少一人投票",
  mutual: "兩人共同投票",
};

const ITALIAN_LESSONS = [
  {
    chinese: "吃",
    italian: "mangiare",
    example: "Mangiamo!",
    meaning: "我們吃吧！",
  },
  {
    chinese: "我餓了",
    italian: "Ho fame",
    example: "Ho fame.",
    meaning: "我餓了。",
  },
  {
    chinese: "好吃",
    italian: "buono",
    example: "È buono!",
    meaning: "真好吃！",
  },
  {
    chinese: "晚餐",
    italian: "la cena",
    example: "La cena è pronta.",
    meaning: "晚餐準備好了。",
  },
  {
    chinese: "請",
    italian: "per favore",
    example: "Il menù, per favore.",
    meaning: "請給我菜單。",
  },
  {
    chinese: "謝謝",
    italian: "grazie",
    example: "Grazie mille!",
    meaning: "非常謝謝！",
  },
  {
    chinese: "乾杯",
    italian: "cin cin",
    example: "Cin cin!",
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
