/**
 * Smoke test del radar: lee Google News RSS real y muestra los ítems parseados.
 * Uso: npx tsx scripts/smoke-radar.ts [término]
 */
import { fetchGoogleNews } from "../src/lib/radar/rss";

const term = process.argv[2] || "gastronomía";
fetchGoogleNews([term]).then((items) => {
  console.log(`${items.length} ítems para "${term}"`);
  for (const i of items.slice(0, 5)) {
    console.log(`- [${i.source} · ${i.pubDate.slice(0, 16)}] ${i.title.slice(0, 90)}`);
  }
  if (!items.length) process.exit(2);
});
