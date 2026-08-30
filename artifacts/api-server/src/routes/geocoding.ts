import { Router, type IRouter } from "express";
import {
  SearchLocationsQueryParams,
  SearchLocationsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_VIEWBOX = "-63.8,18.8,-61.2,16.7";
const NOMINATIM_MIN_INTERVAL_MS = 1_000;
let lastNominatimRequestAt = 0;
const resultCache = new Map<string, ReturnType<typeof SearchLocationsResponse.parse>>();

router.get("/geocode/search", async (req, res): Promise<void> => {
  const parsed = SearchLocationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const query = parsed.data.q.trim();
  const limit = parsed.data.limit ?? 5;
  const cacheKey = `${query.toLowerCase()}::${limit}`;
  const cached = resultCache.get(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  const wait = NOMINATIM_MIN_INTERVAL_MS - (Date.now() - lastNominatimRequestAt);
  if (wait > 0) {
    res.setHeader("Retry-After", Math.ceil(wait / 1_000));
    res.status(429).json({ error: "Search is cooling down. Try again in a moment." });
    return;
  }

  lastNominatimRequestAt = Date.now();
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("viewbox", NOMINATIM_VIEWBOX);
  url.searchParams.set("bounded", "1");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "en");

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Whale Call geocoder/1.0",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      res.status(502).json({ error: "The location service is unavailable right now." });
      return;
    }

    const upstream = (await response.json()) as unknown;
    if (!Array.isArray(upstream)) {
      res.status(502).json({ error: "The location service returned an unexpected response." });
      return;
    }

    const results = upstream.flatMap((place) => {
      if (!place || typeof place !== "object") return [];
      const record = place as Record<string, unknown>;
      const lat = Number(record.lat);
      const lng = Number(record.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || typeof record.display_name !== "string") return [];
      return [{
        placeId: String(record.place_id ?? `${lat}:${lng}`),
        displayName: record.display_name,
        name: typeof record.name === "string" && record.name ? record.name : record.display_name.split(",")[0],
        lat,
        lng,
        category: typeof record.category === "string" ? record.category : "place",
        type: typeof record.type === "string" ? record.type : "location",
      }];
    });
    const data = SearchLocationsResponse.parse(results);
    resultCache.set(cacheKey, data);
    if (resultCache.size > 50) resultCache.delete(resultCache.keys().next().value as string);
    res.json(data);
  } catch {
    res.status(502).json({ error: "The location service is unavailable right now." });
  }
});

export default router;