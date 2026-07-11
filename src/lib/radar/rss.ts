import { load } from "cheerio";
import { fetchLimited } from "@/lib/ingest/url";

export type RadarItem = {
  title: string;
  link: string;
  source: string;
  pubDate: string;
  description: string;
};

const MAX_QUERIES = 3;
const MAX_PER_FEED = 15;
const MAX_TOTAL = 25;
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Noticias recientes del rubro vía Google News RSS (sin API key). Los términos
 * solo entran como valor del parámetro `q` sobre un host fijo — sin superficie
 * SSRF. Parseo defensivo: una query que falla no tumba el radar.
 */
export async function fetchGoogleNews(queries: string[]): Promise<RadarItem[]> {
  const items: RadarItem[] = [];
  for (const q of queries.filter((s) => s.trim()).slice(0, MAX_QUERIES)) {
    const params = new URLSearchParams({
      q: `"${q.trim()}" when:7d`,
      hl: "es-419",
      gl: "UY",
      ceid: "UY:es-419",
    });
    const url = `https://news.google.com/rss/search?${params.toString()}`;
    try {
      const { bytes } = await fetchLimited(url);
      const xml = new TextDecoder().decode(bytes);
      const $ = load(xml, { xmlMode: true });
      $("item")
        .slice(0, MAX_PER_FEED)
        .each((_, el) => {
          const $el = $(el);
          const title = $el.find("title").first().text().trim();
          if (!title) return;
          const rawDesc = $el.find("description").first().text();
          const description = rawDesc
            ? load(rawDesc)("body").text().replace(/\s+/g, " ").trim().slice(0, 300)
            : "";
          items.push({
            title,
            link: $el.find("link").first().text().trim(),
            source: $el.find("source").first().text().trim(),
            pubDate: $el.find("pubDate").first().text().trim(),
            description,
          });
        });
    } catch {
      continue;
    }
  }

  const seen = new Set<string>();
  const cutoff = Date.now() - WINDOW_MS;
  return items
    .filter((item) => {
      const key = item.title.toLowerCase().replace(/\s+/g, " ").trim();
      if (seen.has(key)) return false;
      seen.add(key);
      const t = Date.parse(item.pubDate);
      return Number.isNaN(t) || t >= cutoff;
    })
    .slice(0, MAX_TOTAL);
}
