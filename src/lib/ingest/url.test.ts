import { beforeEach, describe, expect, it, vi } from "vitest";
import { lookup } from "node:dns/promises";
import { extractPublicUrl } from "./url";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));

const mockedLookup = vi.mocked(lookup);

describe("extractPublicUrl para YouTube", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedLookup.mockResolvedValue([{ address: "142.250.184.206", family: 4 }] as never);
  });

  it("usa el cliente Android cuando timedtext web devuelve vacío", async () => {
    const html = `<!doctype html><html><head>
      <title>Charla de prueba</title>
      <meta name="description" content="Descripción pública">
      </head><body>
      <script>var cfg={"INNERTUBE_API_KEY":"api-publica"};</script>
      "captionTracks":[{"baseUrl":"https://www.youtube.com/api/timedtext?direct=1","languageCode":"en"}],"audioTracks":[]
      </body></html>`;
    const player = {
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [
            { baseUrl: "https://www.youtube.com/api/timedtext?fallback=es", languageCode: "es-419" },
            { baseUrl: "https://www.youtube.com/api/timedtext?fallback=en", languageCode: "en" },
          ],
        },
      },
    };

    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("watch?v=abc123")) return new Response(html, { headers: { "Content-Type": "text/html" } });
      if (url.includes("direct=1")) return new Response("", { headers: { "Content-Type": "text/xml" } });
      if (url.includes("youtubei/v1/player")) return Response.json(player);
      if (url.includes("fallback=es")) {
        return new Response("<transcript><text>Hola mundo desde los subtítulos.</text></transcript>", {
          headers: { "Content-Type": "text/xml" },
        });
      }
      throw new Error(`URL inesperada: ${url}`);
    }));

    const result = await extractPublicUrl("https://www.youtube.com/watch?v=abc123");

    expect(result.needsInput).toBe(false);
    expect(result.text).toContain("Transcript: Hola mundo desde los subtítulos.");
    expect(result.metadata).toMatchObject({ video: true, transcript: "public_track", language: "es-419" });
  });
});
