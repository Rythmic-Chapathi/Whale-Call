import { Router, type IRouter } from "express";
import {
  GetFleetBoatParams,
  GetFleetBoatResponse,
  GetFleetSummaryResponse,
  ListFleetQueryParams,
  ListFleetResponse,
  ListIslandsResponse,
} from "@workspace/api-zod";
import {
  getApiBoat,
  getApiIslandList,
  getFleetSummary,
  listApiBoats,
} from "../lib/fleet";

const router: IRouter = Router();

router.get("/islands", async (_req, res): Promise<void> => {
  const data = await getApiIslandList();
  res.json(ListIslandsResponse.parse(data));
});

router.get("/fleet", async (req, res): Promise<void> => {
  const parsed = ListFleetQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data = await listApiBoats(parsed.data);
  res.json(ListFleetResponse.parse(data));
});

router.get("/fleet/summary", async (_req, res): Promise<void> => {
  const data = await getFleetSummary();
  res.json(GetFleetSummaryResponse.parse(data));
});

router.get("/fleet/:boatId", async (req, res): Promise<void> => {
  const params = GetFleetBoatParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const data = await getApiBoat(params.data.boatId);
  if (!data) {
    res.status(404).json({ error: "Boat not found" });
    return;
  }
  res.json(GetFleetBoatResponse.parse(data));
});

export default router;