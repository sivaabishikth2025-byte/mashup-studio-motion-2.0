import { INGREDIENTS, type Ingredient } from "./catalog";
import { hashString, utcDateKey } from "./utils";

export function dailyIngredients(dateKey = utcDateKey()): Ingredient[] {
  const copy = [...INGREDIENTS];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = hashString(`infinite-mashup:${dateKey}:${i}`) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, 3);
}

export function challengeId(dateKey = utcDateKey()) {
  return `daily-${dateKey}`;
}
