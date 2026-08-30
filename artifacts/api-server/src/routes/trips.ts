import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CompleteTripParams,
  CompleteTripResponse,
  CreateTripBody,
  CreateTripResponse,
  GetTripParams,
  GetTripResponse,
} from "@workspace/api-zod";
import {
  boatsTable,
  db,
  driversTable,
  islandsTable,
  tripsTable,
} from "@workspace/db";
import {
  getApiBoat,
  haversineKm,
  type Coordinate,
  type Dock,
} from "../lib/fleet";

const router: IRouter = Router();

async function getApiTrip(tripId: string) {
  const [trip] = await db.select().from(tripsTable).where(eq(tripsTable.id, tripId));
  if (!trip) return undefined;
  const boat = await getApiBoat(trip.boatId);
  if (!boat) return undefined;
  return {
    id: trip.id,
    status: trip.status as "matching" | "assigned" | "arriving" | "arrived" | "in_transit" | "completed",
    pickupIslandId: trip.pickupIslandId,
    pickupDockId: trip.pickupDockId,
    destinationIslandId: trip.destinationIslandId,
    destinationDockId: trip.destinationDockId,
    boatClass: trip.boatClass,
    passengerCount: trip.passengerCount,
    boat,
    price: trip.price,
    etaMinutes: trip.etaMinutes,
    distanceKm: trip.distanceKm,
    requestedAt: trip.requestedAt,
    targetArrivalAt: trip.targetArrivalAt,
  };
}

router.post("/trips", async (req, res): Promise<void> => {
  const parsed = CreateTripBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [pickupIsland] = await db
    .select()
    .from(islandsTable)
    .where(eq(islandsTable.id, parsed.data.pickupIslandId));
  const [destinationIsland] = await db
    .select()
    .from(islandsTable)
    .where(eq(islandsTable.id, parsed.data.destinationIslandId));
  if (!pickupIsland || !destinationIsland) {
    res.status(400).json({ error: "Choose two valid islands." });
    return;
  }
  if (pickupIsland.id === destinationIsland.id) {
    res.status(400).json({ error: "Departure and destination must be different islands." });
    return;
  }

  const pickupDock = pickupIsland.docks.find(
    (dock: Dock) => dock.id === parsed.data.pickupDockId,
  );
  const destinationDock = destinationIsland.docks.find(
    (dock: Dock) => dock.id === parsed.data.destinationDockId,
  );
  if (!pickupDock || !destinationDock) {
    res.status(400).json({ error: "Choose valid docks for both islands." });
    return;
  }

  const boats = await db
    .select()
    .from(boatsTable)
    .where(eq(boatsTable.boatClass, parsed.data.boatClass));
  const available = boats
    .filter((boat) => boat.status === "available" && boat.capacity >= parsed.data.passengerCount)
    .sort(
      (a, b) =>
        haversineKm(pickupDock.position, { lat: a.lat, lng: a.lng }) -
        haversineKm(pickupDock.position, { lat: b.lat, lng: b.lng }),
    )[0];
  if (!available) {
    res.status(400).json({ error: "No boats are available in that class right now." });
    return;
  }

  const distanceKm = Number(
    haversineKm(pickupDock.position, destinationDock.position).toFixed(1),
  );
  const classMultiplier =
    parsed.data.boatClass === "speedboat"
      ? 1.8
      : parsed.data.boatClass === "catamaran"
        ? 1.5
        : parsed.data.boatClass === "cruiser"
          ? 1.25
          : 1;
  const price = Number((18 + distanceKm * 6.2 * classMultiplier).toFixed(2));
  const etaMinutes = Math.max(3, Math.ceil(haversineKm(pickupDock.position, {
    lat: available.lat,
    lng: available.lng,
  }) * 20));
  const requestedAt = new Date();
  const targetArrivalAt = new Date(requestedAt.getTime() + etaMinutes * 60_000);
  const tripId = `trip-${Date.now().toString(36)}`;

  await db.transaction(async (tx) => {
    await tx
      .update(boatsTable)
      .set({ status: "on_trip" })
      .where(eq(boatsTable.id, available.id));
    await tx.insert(tripsTable).values({
      id: tripId,
      status: "arriving",
      pickupIslandId: parsed.data.pickupIslandId,
      pickupDockId: parsed.data.pickupDockId,
      destinationIslandId: parsed.data.destinationIslandId,
      destinationDockId: parsed.data.destinationDockId,
      boatClass: parsed.data.boatClass,
      passengerCount: parsed.data.passengerCount,
      boatId: available.id,
      price,
      etaMinutes,
      distanceKm,
      requestedAt,
      targetArrivalAt,
    });
  });

  const data = await getApiTrip(tripId);
  res.status(201).json(CreateTripResponse.parse(data));
});

router.get("/trips/:tripId", async (req, res): Promise<void> => {
  const params = GetTripParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const data = await getApiTrip(params.data.tripId);
  if (!data) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }
  res.json(GetTripResponse.parse(data));
});

router.post("/trips/:tripId/complete", async (req, res): Promise<void> => {
  const params = CompleteTripParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [trip] = await db
    .select()
    .from(tripsTable)
    .where(eq(tripsTable.id, params.data.tripId));
  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }
  await db
    .update(tripsTable)
    .set({ status: "completed" })
    .where(eq(tripsTable.id, trip.id));
  await db
    .update(boatsTable)
    .set({ status: "available" })
    .where(eq(boatsTable.id, trip.boatId));
  const data = await getApiTrip(trip.id);
  res.json(CompleteTripResponse.parse(data));
});

export default router;