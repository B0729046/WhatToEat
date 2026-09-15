export function normalizeMapsUrl(value) {
  const url = new URL(String(value || "").trim());
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|g_st|entry|share|sa$)/i.test(key)) url.searchParams.delete(key);
  }
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/$/, "");
  return url.toString();
}

export function normalizeIdentity(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("zh-Hant")
    .replace(/[\s·・‧,，.。'’"「」『』()（）\-_]/g, "");
}

export function findDuplicateRestaurant(restaurants, candidate) {
  let candidateUrl = "";
  try {
    candidateUrl = normalizeMapsUrl(candidate.mapUrl);
  } catch {
    // Invalid URLs are handled by the request validator.
  }
  const identity = `${normalizeIdentity(candidate.name)}|${normalizeIdentity(candidate.area)}`;
  return restaurants.find((restaurant) => {
    let storedUrl = "";
    try {
      storedUrl = normalizeMapsUrl(restaurant.mapUrl);
    } catch {
      // Older records may not contain a valid URL.
    }
    return (
      (candidateUrl && storedUrl === candidateUrl) ||
      `${normalizeIdentity(restaurant.name)}|${normalizeIdentity(restaurant.area)}` ===
        identity
    );
  });
}

export function mealDateConflict(records, oldDate, newDate) {
  return oldDate !== newDate && Object.hasOwn(records, newDate);
}
