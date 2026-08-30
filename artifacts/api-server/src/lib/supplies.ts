import { asc, eq, inArray } from "drizzle-orm";
import {
  boatsTable,
  db,
  emergenciesTable,
  supplyDepotsTable,
  supplyItemsTable,
  supplyOrdersTable,
  type SupplyDepotRow,
  type SupplyOrderRow,
} from "@workspace/db";
import type { Coordinate, SupplyOrder, SupplyOrderInput } from "@workspace/api-zod";
import { getApiBoat, haversineKm } from "./fleet";
import { logger } from "./logger";
import { priorityReason, priorityScore } from "./supplyPriority";

export const SUPPLY_ITEMS = [
  { id: "item-water-20l", name: "Drinking water (20L)", category: "water", unit: "jug", weightKg: 20, coldChain: false, criticality: 2, maxPerOrder: 12 },
  { id: "item-water-tabs", name: "Water purification tablets", category: "water", unit: "pack", weightKg: 0.2, coldChain: false, criticality: 2, maxPerOrder: 10 },
  { id: "item-rations", name: "Family ration packs", category: "food", unit: "case", weightKg: 12, coldChain: false, criticality: 2, maxPerOrder: 10 },
  { id: "item-formula", name: "Infant formula", category: "food", unit: "case", weightKg: 5, coldChain: false, criticality: 3, maxPerOrder: 6 },
  { id: "item-first-aid", name: "First-aid kit", category: "medical", unit: "kit", weightKg: 4, coldChain: false, criticality: 2, maxPerOrder: 6 },
  { id: "item-insulin", name: "Insulin cold pack", category: "medical", unit: "kit", weightKg: 2, coldChain: true, criticality: 3, maxPerOrder: 3 },
  { id: "item-oxygen", name: "Oxygen cylinder", category: "medical", unit: "unit", weightKg: 18, coldChain: false, criticality: 3, maxPerOrder: 4 },
  { id: "item-antibiotics", name: "Antibiotics course pack", category: "medical", unit: "pack", weightKg: 1, coldChain: false, criticality: 3, maxPerOrder: 8 },
  { id: "item-generator", name: "Portable generator", category: "power", unit: "unit", weightKg: 72, coldChain: false, criticality: 2, maxPerOrder: 2 },
  { id: "item-fuel", name: "Sealed fuel can", category: "power", unit: "can", weightKg: 20, coldChain: false, criticality: 2, maxPerOrder: 6 },
  { id: "item-battery", name: "Battery bank", category: "power", unit: "unit", weightKg: 8, coldChain: false, criticality: 1, maxPerOrder: 8 },
  { id: "item-tarp", name: "Storm tarpaulin", category: "shelter", unit: "unit", weightKg: 10, coldChain: false, criticality: 2, maxPerOrder: 8 },
  { id: "item-blankets", name: "Dry blanket bundle", category: "shelter", unit: "case", weightKg: 9, coldChain: false, criticality: 1, maxPerOrder: 10 },
  { id: "item-vhf", name: "VHF handset", category: "comms", unit: "unit", weightKg: 1.4, coldChain: false, criticality: 2, maxPerOrder: 6 },
] as const;

const DEPOT_SEED = [
  { id: "depot-lighthouse", name: "Lighthouse Supply Store", islandId: "lighthouse-isle", dockId: "light-house", position: { lat: 17.294, lng: -62.722 }, hours: "First light to last launch", inventory: { "item-first-aid": 18, "item-insulin": 8, "item-oxygen": 10, "item-antibiotics": 16, "item-vhf": 12, "item-water-tabs": 8 } },
  { id: "depot-mango", name: "Mango Harbor Provisions", islandId: "mango-harbor", dockId: "mango-old", position: { lat: 17.896, lng: -62.852 }, hours: "Daily, 06:00–19:00", inventory: { "item-water-20l": 80, "item-water-tabs": 32, "item-rations": 50, "item-formula": 18, "item-blankets": 20, "item-battery": 10 } },
  { id: "depot-coral", name: "Cove Landing Stores", islandId: "coral-cove", dockId: "coral-main", position: { lat: 18.067, lng: -63.087 }, hours: "Daily, 06:30–18:30", inventory: { "item-generator": 8, "item-fuel": 24, "item-battery": 28, "item-tarp": 22, "item-blankets": 16, "item-vhf": 6 } },
  { id: "depot-turtle", name: "Turtle Point Outpost", islandId: "turtle-point", dockId: "turtle-north", position: { lat: 17.137, lng: -62.624 }, hours: "Weather permitting", inventory: { "item-water-20l": 3, "item-rations": 4, "item-first-aid": 2, "item-tarp": 2, "item-vhf": 1 } },
] as const;

const SPEED_KMH: Record<string, number> = { speedboat: 45, water_taxi: 32, catamaran: 28, cruiser: 25, rescue: 40 };
let supplyLock = Promise.resolve();
let ticker: NodeJS.Timeout | undefined;

function withSupplyLock<T>(work: () => Promise<T>): Promise<T> {
  const run = supplyLock.then(work, work);
  supplyLock = run.then(() => undefined, () => undefined);
  return run;
}

function availableStock(depot: SupplyDepotRow, itemId: string): number {
  return Math.max(0, (depot.inventory[itemId] ?? 0) - (depot.reserved[itemId] ?? 0));
}

export async function seedSupplies(reset = false): Promise<void> {
  for (const item of SUPPLY_ITEMS) {
    await db.insert(supplyItemsTable).values(item).onConflictDoUpdate({
      target: supplyItemsTable.id,
      set: item,
    });
  }
  const existing = await db.select().from(supplyDepotsTable);
  if (reset || existing.length === 0) {
    for (const depot of DEPOT_SEED) {
      const values = {
        id: depot.id,
        name: depot.name,
        islandId: depot.islandId,
        dockId: depot.dockId,
        lat: depot.position.lat,
        lng: depot.position.lng,
        hours: depot.hours,
        inventory: { ...depot.inventory },
        reserved: {},
      };
      await db.insert(supplyDepotsTable).values({
        ...values,
      }).onConflictDoUpdate({
        target: supplyDepotsTable.id,
        set: values,
      });
    }
  }
  const boats = await db.select().from(boatsTable).orderBy(asc(boatsTable.id));
  for (const [index, boat] of boats.entries()) {
    const payloadKg = boat.boatClass === "catamaran" ? 1800 : boat.boatClass === "rescue" ? 1200 : boat.boatClass === "cruiser" ? 900 : boat.boatClass === "water_taxi" ? 450 : 250;
    const refrigerated = boat.boatClass === "rescue" || boat.boatClass === "cruiser" && index % 2 === 0;
    await db.update(boatsTable).set({ payloadKg, refrigerated }).where(eq(boatsTable.id, boat.id));
  }
  const refreshedBoats = await db.select().from(boatsTable);
  const capable = refreshedBoats.filter(boat => boat.status === "available" && boat.payloadKg >= 400);
  if (capable.length < 6) {
    logger.error({ capable: capable.length }, "Supply boot assertion failed: fewer than 6 capable boats were available; auto-correcting");
    for (const boat of refreshedBoats.filter(boat => boat.payloadKg >= 400).slice(0, 6)) {
      await db.update(boatsTable).set({ status: "available" }).where(eq(boatsTable.id, boat.id));
    }
  }
  const cold = refreshedBoats.filter(boat => boat.status === "available" && boat.refrigerated);
  if (cold.length < 2) {
    logger.error({ refrigerated: cold.length }, "Supply boot assertion failed: fewer than 2 refrigerated boats were available; auto-correcting");
    for (const boat of refreshedBoats.filter(boat => boat.refrigerated).slice(0, 2)) {
      await db.update(boatsTable).set({ status: "available" }).where(eq(boatsTable.id, boat.id));
    }
  }
  const depots = await db.select().from(supplyDepotsTable);
  for (const item of SUPPLY_ITEMS) {
    if (!depots.some(depot => availableStock(depot, item.id) > 0)) {
      logger.error({ itemId: item.id }, "Supply boot assertion failed: item had no stock; auto-correcting");
      const depot = depots[0];
      await db.update(supplyDepotsTable).set({ inventory: { ...depot.inventory, [item.id]: 5 } }).where(eq(supplyDepotsTable.id, depot.id));
    }
  }
}

export async function listCatalog() {
  const [items, depots] = await Promise.all([db.select().from(supplyItemsTable), db.select().from(supplyDepotsTable)]);
  return items.map(item => ({
    ...item,
    category: item.category as "medical" | "water" | "food" | "power" | "shelter" | "comms",
    availableTotal: depots.reduce((sum, depot) => sum + availableStock(depot, item.id), 0),
  }));
}

export async function listDepots() {
  return (await db.select().from(supplyDepotsTable)).map(depot => ({
    id: depot.id,
    name: depot.name,
    islandId: depot.islandId,
    dockId: depot.dockId,
    position: { lat: depot.lat, lng: depot.lng },
    hours: depot.hours,
    available: Object.fromEntries(Object.keys(depot.inventory).map(itemId => [itemId, availableStock(depot, itemId)])),
  }));
}

export async function getAvailability(itemId: string, quantity: number, position: Coordinate) {
  const depots = await db.select().from(supplyDepotsTable);
  return depots.map(depot => {
    const distanceKm = Number(haversineKm(position, { lat: depot.lat, lng: depot.lng }).toFixed(1));
    return { depotId: depot.id, depotName: depot.name, available: availableStock(depot, itemId), distanceKm, etaMinutes: Math.max(3, Math.ceil(distanceKm / 32 * 60)) };
  }).filter(entry => entry.available > 0).sort((a, b) => a.distanceKm - b.distanceKm || Number(b.available >= quantity) - Number(a.available >= quantity));
}

function orderMaxCriticality(order: SupplyOrderRow, itemMap: Map<string, { criticality: number }>): number {
  return Math.max(1, ...order.requestedLines.map(line => itemMap.get(line.itemId)?.criticality ?? 1));
}

export async function hydrateSupplyOrder(order: SupplyOrderRow): Promise<SupplyOrder> {
  const [items, depots] = await Promise.all([
    db.select().from(supplyItemsTable),
    db.select().from(supplyDepotsTable),
  ]);
  const itemMap = new Map(items.map(item => [item.id, item]));
  let boat = order.boatId ? await getApiBoat(order.boatId) : undefined;
  const now = new Date();
  const etaMinutes = order.status === "delivered" ? 0 : order.targetDeliveryAt ? Math.max(0, Math.ceil((order.targetDeliveryAt.getTime() - now.getTime()) / 60_000)) : null;
  if (boat && order.status === "loading") {
    const pickup = depots.find(depot => depot.id === order.lines[order.lines.length - 1]?.depotId);
    if (pickup) boat = { ...boat, position: { lat: pickup.lat, lng: pickup.lng } };
  } else if (boat && order.status === "in_transit" && order.targetDeliveryAt) {
    const pickup = depots.find(depot => depot.id === order.lines[order.lines.length - 1]?.depotId);
    if (pickup) {
      const transitStart = order.createdAt.getTime() + 60_000;
      const progress = Math.max(0, Math.min(1, (now.getTime() - transitStart) / (order.targetDeliveryAt.getTime() - transitStart)));
      boat = {
        ...boat,
        position: {
          lat: pickup.lat + (order.destinationLat - pickup.lat) * progress,
          lng: pickup.lng + (order.destinationLng - pickup.lng) * progress,
        },
      };
    }
  }
  const maxCriticality = orderMaxCriticality(order, itemMap);
  return {
    id: order.id,
    createdAt: order.createdAt,
    deliveredAt: order.deliveredAt,
    lines: order.lines,
    requestedLines: order.requestedLines,
    destinationIslandId: order.destinationIslandId,
    destinationDockId: order.destinationDockId,
    destinationPosition: { lat: order.destinationLat, lng: order.destinationLng },
    requesterNote: order.requesterNote,
    urgency: order.urgency as SupplyOrder["urgency"],
    accessibilityNeed: order.accessibilityNeed,
    linkedEmergencyId: order.linkedEmergencyId,
    priorityScore: priorityScore({ urgency: order.urgency as "routine" | "urgent" | "critical", maxCriticality, accessibilityNeed: order.accessibilityNeed, linkedEmergencyId: order.linkedEmergencyId, createdAt: order.createdAt }),
    priorityReason: priorityReason({ urgency: order.urgency as "routine" | "urgent" | "critical", maxCriticality, accessibilityNeed: order.accessibilityNeed, linkedEmergencyId: order.linkedEmergencyId }),
    status: order.status as SupplyOrder["status"],
    boatId: order.boatId,
    boat: boat ?? null,
    totalWeightKg: order.totalWeightKg,
    etaMinutes,
    distanceKm: order.distanceKm,
    fare: order.fare,
    unfilledLines: order.unfilledLines,
    allocationNote: order.allocationNote,
  };
}

export async function getSupplyOrderById(id: string) {
  await advanceSupplyOrders();
  const [order] = await db.select().from(supplyOrdersTable).where(eq(supplyOrdersTable.id, id));
  return order ? hydrateSupplyOrder(order) : undefined;
}

export async function createSupplyOrder(input: SupplyOrderInput): Promise<SupplyOrder> {
  return withSupplyLock(async () => {
    const [items, depots, boats] = await Promise.all([
      db.select().from(supplyItemsTable),
      db.select().from(supplyDepotsTable),
      db.select().from(boatsTable),
    ]);
    const itemMap = new Map(items.map(item => [item.id, item]));
    for (const line of input.lines) {
      const item = itemMap.get(line.itemId);
      if (!item) throw Object.assign(new Error(`We do not stock ${line.itemId}.`), { status: 400, code: "UNKNOWN_ITEM" });
      if (line.quantity > item.maxPerOrder) throw Object.assign(new Error(`${item.name} is limited to ${item.maxPerOrder} per run.`), { status: 400, code: "EXCEEDS_MAX_PER_ORDER" });
    }
    const rankedDepots = [...depots].sort((a, b) => haversineKm(input.destinationPosition, { lat: a.lat, lng: a.lng }) - haversineKm(input.destinationPosition, { lat: b.lat, lng: b.lng }));
    const allocations: Array<{ itemId: string; quantity: number; depotId: string }> = [];
    const unfilledLines: Array<{ itemId: string; quantity: number }> = [];
    const reservedByDepot = new Map<string, Record<string, number>>();
    for (const requested of input.lines) {
      let remaining = requested.quantity;
      for (const depot of rankedDepots) {
        const quantity = Math.min(remaining, availableStock(depot, requested.itemId));
        if (quantity <= 0) continue;
        allocations.push({ itemId: requested.itemId, quantity, depotId: depot.id });
        const reserved = reservedByDepot.get(depot.id) ?? { ...depot.reserved };
        reserved[requested.itemId] = (reserved[requested.itemId] ?? 0) + quantity;
        reservedByDepot.set(depot.id, reserved);
        depot.reserved = reserved;
        remaining -= quantity;
        if (remaining === 0) break;
      }
      if (remaining > 0) unfilledLines.push({ itemId: requested.itemId, quantity: remaining });
    }
    if (allocations.length === 0) {
      throw Object.assign(new Error("Those shelves are empty right now."), { status: 409, code: "INSUFFICIENT_STOCK", remedy: "Reduce the quantity or choose another supply." });
    }
    const totalWeightKg = Number(allocations.reduce((sum, line) => sum + (itemMap.get(line.itemId)?.weightKg ?? 0) * line.quantity, 0).toFixed(1));
    const needsColdChain = allocations.some(line => itemMap.get(line.itemId)?.coldChain);
    const pickupDepots = [...new Set(allocations.map(line => line.depotId))].map(id => depots.find(depot => depot.id === id)!).filter(Boolean);
    const firstPickup = pickupDepots[0];
    const maxCriticality = Math.max(...allocations.map(line => itemMap.get(line.itemId)?.criticality ?? 1));
    let allocationNote: string | null = null;
    const eligible = (status: string, includeRescue = false) => boats.filter(boat => boat.status === status && boat.payloadKg >= totalWeightKg && (!needsColdChain || boat.refrigerated) && (includeRescue || boat.boatClass !== "rescue"));
    let boat = eligible("available").sort((a, b) => haversineKm({ lat: a.lat, lng: a.lng }, { lat: firstPickup.lat, lng: firstPickup.lng }) - haversineKm({ lat: b.lat, lng: b.lng }, { lat: firstPickup.lat, lng: firstPickup.lng }))[0];
    if (!boat) boat = eligible("en_route").sort((a, b) => haversineKm({ lat: a.lat, lng: a.lng }, { lat: firstPickup.lat, lng: firstPickup.lng }) - haversineKm({ lat: b.lat, lng: b.lng }, { lat: firstPickup.lat, lng: firstPickup.lng }))[0];
    if (!boat && maxCriticality === 3) {
      boat = boats.filter(candidate => candidate.boatClass === "rescue" && candidate.status !== "offline" && candidate.payloadKg >= totalWeightKg && (!needsColdChain || candidate.refrigerated))[0];
      if (boat) allocationNote = "Re-tasked a rescue vessel for a life-critical run.";
    }
    if (!boat) {
      const code = needsColdChain ? "NO_COLD_CHAIN_BOAT" : "NO_CAPABLE_BOAT";
      const message = needsColdChain ? "No refrigerated hold is free for these cold-chain supplies." : `No boat on the water can carry ${totalWeightKg} kg right now.`;
      throw Object.assign(new Error(message), { status: 409, code, remedy: "Split this into two runs, or reduce the order." });
    }
    let distanceKm = haversineKm({ lat: boat.lat, lng: boat.lng }, { lat: firstPickup.lat, lng: firstPickup.lng });
    for (let i = 0; i < pickupDepots.length - 1; i += 1) distanceKm += haversineKm({ lat: pickupDepots[i].lat, lng: pickupDepots[i].lng }, { lat: pickupDepots[i + 1].lat, lng: pickupDepots[i + 1].lng });
    const lastDepot = pickupDepots[pickupDepots.length - 1];
    distanceKm += haversineKm({ lat: lastDepot.lat, lng: lastDepot.lng }, input.destinationPosition);
    distanceKm = Number(distanceKm.toFixed(1));
    const etaMinutes = Math.max(5, Math.ceil(distanceKm / (SPEED_KMH[boat.boatClass] ?? 30) * 60) + 3);
    const fare = input.linkedEmergencyId ? 0 : Number((12 + distanceKm * 1.1 + totalWeightKg * 0.35).toFixed(2));
    const now = new Date();
    const id = `run-${Date.now().toString(36)}`;
    await db.transaction(async tx => {
      for (const [depotId, reserved] of reservedByDepot) await tx.update(supplyDepotsTable).set({ reserved }).where(eq(supplyDepotsTable.id, depotId));
      await tx.update(boatsTable).set({ status: "on_trip" }).where(eq(boatsTable.id, boat.id));
      await tx.insert(supplyOrdersTable).values({
        id,
        status: unfilledLines.length ? "partially_filled" : "allocated",
        lines: allocations,
        requestedLines: input.lines,
        destinationIslandId: input.destinationIslandId ?? null,
        destinationDockId: input.destinationDockId ?? null,
        destinationLat: input.destinationPosition.lat,
        destinationLng: input.destinationPosition.lng,
        requesterNote: input.requesterNote,
        urgency: input.urgency,
        accessibilityNeed: input.accessibilityNeed,
        linkedEmergencyId: input.linkedEmergencyId ?? null,
        boatId: boat.id,
        totalWeightKg,
        etaMinutes,
        distanceKm,
        fare,
        unfilledLines,
        allocationNote,
        createdAt: now,
        targetDeliveryAt: new Date(now.getTime() + etaMinutes * 60_000),
      });
    });
    const order = await getSupplyOrderById(id);
    if (!order) throw new Error("Supply run could not be opened after allocation.");
    return order;
  });
}

export async function cancelSupplyOrderById(id: string) {
  return withSupplyLock(async () => {
    const [order] = await db.select().from(supplyOrdersTable).where(eq(supplyOrdersTable.id, id));
    if (!order) return undefined;
    if (!["sourcing", "allocated", "partially_filled"].includes(order.status)) throw Object.assign(new Error("That run is already on the water and cannot be cancelled."), { status: 409, code: "RUN_UNDERWAY" });
    const depots = await db.select().from(supplyDepotsTable);
    for (const depot of depots) {
      const reserved = { ...depot.reserved };
      for (const line of order.lines.filter(entry => entry.depotId === depot.id)) reserved[line.itemId] = Math.max(0, (reserved[line.itemId] ?? 0) - line.quantity);
      await db.update(supplyDepotsTable).set({ reserved }).where(eq(supplyDepotsTable.id, depot.id));
    }
    await db.update(supplyOrdersTable).set({ status: "cancelled" }).where(eq(supplyOrdersTable.id, id));
    if (order.boatId) await db.update(boatsTable).set({ status: "available" }).where(eq(boatsTable.id, order.boatId));
    return getSupplyOrderById(id);
  });
}

export async function advanceSupplyOrders() {
  const active = await db.select().from(supplyOrdersTable).where(inArray(supplyOrdersTable.status, ["sourcing", "allocated", "partially_filled", "loading", "in_transit"]));
  const now = new Date();
  for (const order of active) {
    const elapsed = (now.getTime() - order.createdAt.getTime()) / 1000;
    if (order.targetDeliveryAt && now >= order.targetDeliveryAt) {
      await withSupplyLock(async () => {
        const [fresh] = await db.select().from(supplyOrdersTable).where(eq(supplyOrdersTable.id, order.id));
        if (!fresh || fresh.deliveredAt) return;
        const depots = await db.select().from(supplyDepotsTable);
        for (const depot of depots) {
          const inventory = { ...depot.inventory };
          const reserved = { ...depot.reserved };
          for (const line of fresh.lines.filter(entry => entry.depotId === depot.id)) {
            inventory[line.itemId] = Math.max(0, (inventory[line.itemId] ?? 0) - line.quantity);
            reserved[line.itemId] = Math.max(0, (reserved[line.itemId] ?? 0) - line.quantity);
          }
          await db.update(supplyDepotsTable).set({ inventory, reserved }).where(eq(supplyDepotsTable.id, depot.id));
        }
        await db.update(supplyOrdersTable).set({ status: "delivered", deliveredAt: now }).where(eq(supplyOrdersTable.id, fresh.id));
        if (fresh.boatId) await db.update(boatsTable).set({ status: "available" }).where(eq(boatsTable.id, fresh.boatId));
      });
    } else {
      const status = elapsed >= 60 ? "in_transit" : elapsed >= 30 ? "loading" : order.unfilledLines.length ? "partially_filled" : "allocated";
      if (status !== order.status) await db.update(supplyOrdersTable).set({ status }).where(eq(supplyOrdersTable.id, order.id));
    }
  }
}

export function startSupplyTicker() {
  if (ticker) return;
  ticker = setInterval(() => { void advanceSupplyOrders().catch(err => logger.error({ err }, "Unable to advance supply runs")); }, 5_000);
  ticker.unref();
}

export async function listSupplyQueue() {
  await advanceSupplyOrders();
  const rows = await db.select().from(supplyOrdersTable).where(inArray(supplyOrdersTable.status, ["sourcing", "allocated", "partially_filled", "loading", "in_transit"]));
  const hydrated = await Promise.all(rows.map(hydrateSupplyOrder));
  return hydrated.sort((a, b) => b.priorityScore - a.priorityScore);
}

export async function ageSupplyOrderById(id: string) {
  if (process.env.NODE_ENV === "production") throw Object.assign(new Error("Demo aging is only available in development."), { status: 403, code: "DEV_ONLY" });
  const [order] = await db.select().from(supplyOrdersTable).where(eq(supplyOrdersTable.id, id));
  if (!order) return undefined;
  await db.update(supplyOrdersTable).set({ createdAt: new Date(order.createdAt.getTime() - 5 * 60_000) }).where(eq(supplyOrdersTable.id, id));
  return getSupplyOrderById(id);
}

export async function resetSupplyDemo() {
  if (process.env.NODE_ENV === "production") throw Object.assign(new Error("Demo reset is disabled in production."), { status: 403, code: "DEV_ONLY" });
  const orders = await db.select().from(supplyOrdersTable);
  const boatIds = orders.map(order => order.boatId).filter((id): id is string => Boolean(id));
  await db.delete(supplyOrdersTable);
  if (boatIds.length) await db.update(boatsTable).set({ status: "available" }).where(inArray(boatsTable.id, boatIds));
  await seedSupplies(true);
}

export async function getEmergencyDestination(id: string) {
  const [incident] = await db.select().from(emergenciesTable).where(eq(emergenciesTable.id, id));
  return incident ? { lat: incident.lat, lng: incident.lng } : undefined;
}