import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateEmergencyBody,
  CreateEmergencyResponse,
  GetEmergencyParams,
  GetEmergencyResponse,
  ResolveEmergencyParams,
  ResolveEmergencyResponse,
} from "@workspace/api-zod";
import { boatsTable, db, emergenciesTable } from "@workspace/db";
import {
  findNearestRescueBoat,
  getApiBoat,
  haversineKm,
  type Coordinate,
} from "../lib/fleet";

const router: IRouter = Router();

async function getApiEmergency(emergencyId: string) {
  const [incident] = await db
    .select()
    .from(emergenciesTable)
    .where(eq(emergenciesTable.id, emergencyId));
  if (!incident) return undefined;
  const rescueBoat = await getApiBoat(incident.rescueBoatId);
  if (!rescueBoat) return undefined;
  return {
    id: incident.id,
    status: incident.status as "dispatching" | "responding" | "on_scene" | "resolved",
    situation: incident.situation as "stranded" | "medical" | "taking_on_water" | "other",
    position: { lat: incident.lat, lng: incident.lng },
    notes: incident.notes,
    rescueBoat,
    etaMinutes: Math.ceil(incident.etaMinutes),
    distanceKm: incident.distanceKm,
    createdAt: incident.createdAt,
    tripId: incident.tripId,
  };
}

router.post("/emergencies", async (req, res): Promise<void> => {
  const parsed = CreateEmergencyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const position: Coordinate = parsed.data.position;
  const rescueBoat = await findNearestRescueBoat(position);
  if (!rescueBoat) {
    res.status(400).json({ error: "No rescue boat is currently available." });
    return;
  }
  const distanceKm = Number(haversineKm(position, rescueBoat.position).toFixed(1));
  const etaMinutes = Math.max(2, Math.ceil(distanceKm * 18));
  const emergencyId = `emergency-${Date.now().toString(36)}`;
  await db.transaction(async (tx) => {
    await tx
      .update(boatsTable)
      .set({ status: "en_route" })
      .where(eq(boatsTable.id, rescueBoat.id));
    await tx.insert(emergenciesTable).values({
      id: emergencyId,
      status: "responding",
      situation: parsed.data.situation,
      lat: position.lat,
      lng: position.lng,
      notes: parsed.data.notes,
      rescueBoatId: rescueBoat.id,
      etaMinutes,
      distanceKm,
      tripId: parsed.data.tripId ?? null,
    });
  });
  const data = await getApiEmergency(emergencyId);
  res.status(201).json(CreateEmergencyResponse.parse(data));
});

router.get("/emergencies/:emergencyId", async (req, res): Promise<void> => {
  const params = GetEmergencyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const data = await getApiEmergency(params.data.emergencyId);
  if (!data) {
    res.status(404).json({ error: "Emergency not found" });
    return;
  }
  res.json(GetEmergencyResponse.parse(data));
});

router.post("/emergencies/:emergencyId/resolve", async (req, res): Promise<void> => {
  const params = ResolveEmergencyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [incident] = await db
    .select()
    .from(emergenciesTable)
    .where(eq(emergenciesTable.id, params.data.emergencyId));
  if (!incident) {
    res.status(404).json({ error: "Emergency not found" });
    return;
  }
  await db
    .update(emergenciesTable)
    .set({ status: "resolved" })
    .where(eq(emergenciesTable.id, incident.id));
  await db
    .update(boatsTable)
    .set({ status: "available" })
    .where(eq(boatsTable.id, incident.rescueBoatId));
  const data = await getApiEmergency(incident.id);
  res.json(ResolveEmergencyResponse.parse(data));
});

export default router;