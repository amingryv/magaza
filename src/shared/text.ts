// Shared by the Worker, the front and the seed script (run by plain Node), so
// this file must not import anything.

const AZ_FOLD: Record<string, string> = {
  ə: "e", ı: "i", i̇: "i", ö: "o", ü: "u", ğ: "g", ş: "s", ç: "c",
  // Cyrillic stays Cyrillic; only the one letter people type both ways
  ё: "е",
};

/**
 * Text for `products.search_text`: lower-case, Azerbaijani letters folded to
 * Latin ("Ə" → "e", "İ" → "i"), so "koynek" finds "Köynək". SQLite's LIKE
 * folds only ASCII, so the API stores and searches this form.
 */
export function normalizeSearch(text: string): string {
  return text
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .toLowerCase()
    .normalize("NFC")
    .replace(/[əıöüğşçё]|i̇/g, (ch) => AZ_FOLD[ch] ?? ch)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** "Pambıq köynək 2" → "pambiq-koynek-2" */
export function slugify(text: string): string {
  return normalizeSearch(text)
    .replace(/[^a-z0-9а-я ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}
