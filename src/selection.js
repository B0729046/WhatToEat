export const DRAW_SCOPES = {
  all: "全部候選",
  voted: "至少一人投票",
  mutual: "兩人共同投票",
};

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
      (filters.area === allValue || restaurant.area === filters.area) &&
      (filters.budget === allValue ||
        (restaurant.price != null &&
          restaurant.price <= Number(filters.budget)))
    );
  });
}
