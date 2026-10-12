export const DRAW_SCOPES = {
  all: "全部候選",
  voted: "至少一人投票",
  mutual: "兩人共同投票",
};

const ITALIAN_LESSONS = [
  {
    chinese: "1（一）",
    italian: "uno",
    pronunciation: "烏諾",
    example: "Uno, per favore.",
    examplePronunciation: "烏諾，佩爾 法沃雷",
    meaning: "一個，謝謝。",
  },
  {
    chinese: "2（二）",
    italian: "due",
    pronunciation: "杜耶",
    example: "Siamo in due.",
    examplePronunciation: "西亞莫 因 杜耶",
    meaning: "我們有兩位。",
  },
  {
    chinese: "3（三）",
    italian: "tre",
    pronunciation: "特雷",
    example: "Tre caffè.",
    examplePronunciation: "特雷 咖啡",
    meaning: "三杯咖啡。",
  },
  {
    chinese: "4（四）",
    italian: "quattro",
    pronunciation: "瓜特羅",
    example: "Un tavolo per quattro.",
    examplePronunciation: "溫 塔沃羅 佩爾 瓜特羅",
    meaning: "一張四人桌。",
  },
  {
    chinese: "5（五）",
    italian: "cinque",
    pronunciation: "欽奎",
    example: "Cinque minuti.",
    examplePronunciation: "欽奎 米努提",
    meaning: "五分鐘。",
  },
  {
    chinese: "6（六）",
    italian: "sei",
    pronunciation: "塞伊",
    example: "Sei persone.",
    examplePronunciation: "塞伊 佩爾索內",
    meaning: "六個人。",
  },
  {
    chinese: "7（七）",
    italian: "sette",
    pronunciation: "塞特",
    example: "Sette giorni.",
    examplePronunciation: "塞特 喬爾尼",
    meaning: "七天。",
  },
  {
    chinese: "8（八）",
    italian: "otto",
    pronunciation: "奧托",
    example: "Otto euro.",
    examplePronunciation: "奧托 歐羅",
    meaning: "八歐元。",
  },
  {
    chinese: "9（九）",
    italian: "nove",
    pronunciation: "諾維",
    example: "Nove piatti.",
    examplePronunciation: "諾維 皮亞提",
    meaning: "九道菜。",
  },
  {
    chinese: "10（十）",
    italian: "dieci",
    pronunciation: "迪耶奇",
    example: "Dieci, perfetto!",
    examplePronunciation: "迪耶奇，佩爾費托",
    meaning: "十個，剛剛好！",
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
