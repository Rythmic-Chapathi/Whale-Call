import { and, asc, count, eq } from "drizzle-orm";
import {
  boatsTable,
  db,
  driversTable,
  islandsTable,
  type Boat,
  type Driver,
  type Island,
} from "@workspace/db";
import type {
  Coordinate,
  Dock,
  FleetBoat,
  FleetSummary,
  Island as ApiIsland,
  Driver as ApiDriver,
} from "@workspace/api-zod";

export type { Coordinate, Dock };

export const ISLAND_SEED: Array<{
  id: string;
  name: string;
  tagline: string;
  center: Coordinate;
  coastline: Coordinate[];
  docks: Dock[];
  hasRescueStation: boolean;
}> = [
  {
    id: "coral-cove",
    name: "Saint Martin",
    tagline: "French-Caribbean harbors on a sheltered blue bay",
    center: { lat: 18.07, lng: -63.05 },
    coastline: [
      { lat: 18.036, lng: -63.074 },
      { lat: 18.052, lng: -63.021 },
      { lat: 18.018, lng: -62.997 },
      { lat: 17.979, lng: -63.012 },
      { lat: 17.973, lng: -63.057 },
    ],
    docks: [
      { id: "coral-main", name: "Marigot Ferry Terminal", position: { lat: 18.067, lng: -63.087 } },
      { id: "coral-east", name: "Philipsburg Harbour", position: { lat: 18.017, lng: -63.043 } },
    ],
    hasRescueStation: true,
  },
  {
    id: "pelican-key",
    name: "Anguilla",
    tagline: "Low coral shores and fast ferry connections",
    center: { lat: 18.22, lng: -63.052 },
    coastline: [
      { lat: 18.087, lng: -62.986 },
      { lat: 18.105, lng: -62.946 },
      { lat: 18.081, lng: -62.915 },
      { lat: 18.034, lng: -62.927 },
      { lat: 18.018, lng: -62.968 },
    ],
    docks: [
      { id: "pelican-west", name: "Blowing Point Ferry Terminal", position: { lat: 18.177, lng: -63.093 } },
      { id: "pelican-east", name: "Road Bay Port", position: { lat: 18.202, lng: -63.096 } },
    ],
    hasRescueStation: false,
  },
  {
    id: "mango-harbor",
    name: "Saint Barthélemy",
    tagline: "Compact hillsides gathered around Gustavia",
    center: { lat: 17.9, lng: -62.833 },
    coastline: [
      { lat: 18.114, lng: -62.864 },
      { lat: 18.13, lng: -62.821 },
      { lat: 18.097, lng: -62.783 },
      { lat: 18.048, lng: -62.792 },
      { lat: 18.036, lng: -62.843 },
    ],
    docks: [
      { id: "mango-old", name: "Gustavia Ferry Terminal", position: { lat: 17.896, lng: -62.852 } },
      { id: "mango-south", name: "Port de Gustavia", position: { lat: 17.9, lng: -62.851 } },
    ],
    hasRescueStation: true,
  },
  {
    id: "starfish-bay",
    name: "Sint Eustatius",
    tagline: "Historic Oranjestad beneath the Quill",
    center: { lat: 17.489, lng: -62.973 },
    coastline: [
      { lat: 17.972, lng: -63.006 },
      { lat: 17.991, lng: -62.965 },
      { lat: 17.963, lng: -62.928 },
      { lat: 17.914, lng: -62.933 },
      { lat: 17.9, lng: -62.982 },
    ],
    docks: [
      { id: "starfish-north", name: "Oranjestad Harbour", position: { lat: 17.482, lng: -62.987 } },
      { id: "starfish-market", name: "Gallows Bay Pier", position: { lat: 17.478, lng: -62.986 } },
    ],
    hasRescueStation: false,
  },
  {
    id: "lighthouse-isle",
    name: "Saint Kitts",
    tagline: "Working ports beneath volcanic ridgelines",
    center: { lat: 17.357, lng: -62.783 },
    coastline: [
      { lat: 17.947, lng: -62.873 },
      { lat: 17.962, lng: -62.83 },
      { lat: 17.927, lng: -62.794 },
      { lat: 17.877, lng: -62.799 },
      { lat: 17.863, lng: -62.848 },
    ],
    docks: [
      { id: "light-house", name: "Port Zante", position: { lat: 17.294, lng: -62.722 } },
      { id: "light-east", name: "Basseterre Ferry Terminal", position: { lat: 17.295, lng: -62.724 } },
    ],
    hasRescueStation: true,
  },
  {
    id: "turtle-point",
    name: "Nevis",
    tagline: "Quiet crossings under Nevis Peak",
    center: { lat: 17.155, lng: -62.579 },
    coastline: [
      { lat: 17.855, lng: -62.975 },
      { lat: 17.876, lng: -62.932 },
      { lat: 17.847, lng: -62.894 },
      { lat: 17.8, lng: -62.902 },
      { lat: 17.78, lng: -62.948 },
    ],
    docks: [
      { id: "turtle-north", name: "Charlestown Ferry Terminal", position: { lat: 17.137, lng: -62.624 } },
      { id: "turtle-cove", name: "Oualie Water Taxi Pier", position: { lat: 17.198, lng: -62.617 } },
    ],
    hasRescueStation: false,
  },
  {
    id: "driftwood-island",
    name: "Antigua",
    tagline: "Deep-water harbors and trade-wind passages",
    center: { lat: 17.075, lng: -61.818 },
    coastline: [
      { lat: 17.824, lng: -62.824 },
      { lat: 17.846, lng: -62.783 },
      { lat: 17.813, lng: -62.746 },
      { lat: 17.766, lng: -62.752 },
      { lat: 17.748, lng: -62.801 },
    ],
    docks: [
      { id: "driftwood-west", name: "St. John's Deep Water Harbour", position: { lat: 17.126, lng: -61.849 } },
      { id: "driftwood-east", name: "Heritage Quay", position: { lat: 17.122, lng: -61.844 } },
    ],
    hasRescueStation: true,
  },
];

const CLASS_CONFIG = [
  { boatClass: "water_taxi", capacity: 4, label: "Tide Taxi" },
  { boatClass: "water_taxi", capacity: 4, label: "Sea Sparrow" },
  { boatClass: "cruiser", capacity: 8, label: "Island Cruiser" },
  { boatClass: "catamaran", capacity: 16, label: "Sunset Cat" },
  { boatClass: "speedboat", capacity: 4, label: "Blue Comet" },
  { boatClass: "water_taxi", capacity: 4, label: "Harbor Hopper" },
  { boatClass: "cruiser", capacity: 8, label: "Lagoon Runner" },
  { boatClass: "water_taxi", capacity: 4, label: "Coral Dart" },
  { boatClass: "rescue", capacity: 8, label: "Sea Guard" },
] as const;

const DRIVER_NAMES = [
  "Amara James", "Theo Laurent", "Maya Charles", "Jonas Baptiste",
  "Elena Pierre", "Kai Augustin", "Sienna Jules", "Noah Toussaint",
  "Lina Joseph", "Milo Baptiste", "Zara Antoine", "Eli Moore",
];

const DRIVER_LANGUAGES = [
  ["English", "French"],
  ["English"],
  ["English", "Spanish"],
  ["English", "French", "Spanish"],
];

export async function seedFleet(): Promise<void> {
  for (const island of ISLAND_SEED) {
    const values = {
      id: island.id,
      name: island.name,
      tagline: island.tagline,
      centerLat: island.center.lat,
      centerLng: island.center.lng,
      coastline: island.coastline,
      docks: island.docks,
      hasRescueStation: island.hasRescueStation,
    };
    await db.insert(islandsTable).values(values).onConflictDoUpdate({
      target: islandsTable.id,
      set: values,
    });
  }

  const [{ value }] = await db.select({ value: count() }).from(boatsTable);
  if (Number(value) > 0) return;

  const drivers = Array.from({ length: 72 }, (_, index) => {
    const name = DRIVER_NAMES[index % DRIVER_NAMES.length];
    const initials = name.split(" ").map((part) => part[0]).join("");
    const rescue = (index + 1) % 9 === 0;
    return {
      id: `driver-${index + 1}`,
      name,
      avatar: initials,
      rating: Number((4.72 + ((index * 7) % 27) / 100).toFixed(2)),
      tripsCompleted: 180 + ((index * 43) % 920),
      yearsActive: 2 + (index % 9),
      languages: DRIVER_LANGUAGES[index % DRIVER_LANGUAGES.length],
      certifications: rescue ? ["medical", "tow", "night_ops"] : [],
    };
  });
  await db.insert(driversTable).values(drivers);

  const boats = Array.from({ length: 72 }, (_, index) => {
    const config = CLASS_CONFIG[index % CLASS_CONFIG.length];
    const island = ISLAND_SEED[index % ISLAND_SEED.length];
    const rescue = config.boatClass === "rescue";
    const offset = ((index % 6) - 2.5) * 0.004;
    return {
      id: `boat-${index + 1}`,
      name: `${config.label} ${String(index + 1).padStart(2, "0")}`,
      boatClass: config.boatClass,
      capacity: config.capacity,
      lat: island.center.lat + offset,
      lng: island.center.lng + ((index % 5) - 2) * 0.005,
      heading: (index * 47) % 360,
      status: index % 17 === 0 ? "en_route" : index % 23 === 0 ? "offline" : "available",
      driverId: `driver-${index + 1}`,
      homeIslandId: island.id,
      emergencyEquipped: rescue,
    };
  });
  await db.insert(boatsTable).values(boats);
}

export function toApiDriver(driver: Driver): ApiDriver {
  return {
    id: driver.id,
    name: driver.name,
    avatar: driver.avatar,
    rating: driver.rating,
    tripsCompleted: driver.tripsCompleted,
    yearsActive: driver.yearsActive,
    languages: driver.languages,
    certifications: driver.certifications as ApiDriver["certifications"],
  };
}

export function toApiBoat(boat: Boat, driver: Driver): FleetBoat {
  return {
    id: boat.id,
    name: boat.name,
    boatClass: boat.boatClass as FleetBoat["boatClass"],
    capacity: boat.capacity,
    position: { lat: boat.lat, lng: boat.lng },
    heading: boat.heading,
    status: boat.status as FleetBoat["status"],
    assignedDriver: toApiDriver(driver),
    homeIslandId: boat.homeIslandId,
    emergencyEquipped: boat.emergencyEquipped,
  };
}

export async function listApiBoats(filters?: {
  boatClass?: string;
  status?: string;
  emergencyEquipped?: boolean;
}): Promise<FleetBoat[]> {
  const rows = await db
    .select({ boat: boatsTable, driver: driversTable })
    .from(boatsTable)
    .innerJoin(driversTable, eq(boatsTable.driverId, driversTable.id))
    .where(
      and(
        filters?.boatClass ? eq(boatsTable.boatClass, filters.boatClass) : undefined,
        filters?.status ? eq(boatsTable.status, filters.status) : undefined,
        filters?.emergencyEquipped === undefined
          ? undefined
          : eq(boatsTable.emergencyEquipped, filters.emergencyEquipped),
      ),
    )
    .orderBy(asc(boatsTable.id));
  return rows.map(({ boat, driver }) => toApiBoat(boat, driver));
}

export async function getApiBoat(boatId: string): Promise<FleetBoat | undefined> {
  const [row] = await db
    .select({ boat: boatsTable, driver: driversTable })
    .from(boatsTable)
    .innerJoin(driversTable, eq(boatsTable.driverId, driversTable.id))
    .where(eq(boatsTable.id, boatId));
  return row ? toApiBoat(row.boat, row.driver) : undefined;
}

export async function getApiIslandList(): Promise<ApiIsland[]> {
  const islands = await db.select().from(islandsTable).orderBy(asc(islandsTable.name));
  return islands.map((island: Island) => ({
    id: island.id,
    name: island.name,
    tagline: island.tagline,
    center: { lat: island.centerLat, lng: island.centerLng },
    coastline: island.coastline,
    docks: island.docks,
    hasRescueStation: island.hasRescueStation,
  }));
}

export async function getFleetSummary(): Promise<FleetSummary> {
  const boats = await db.select().from(boatsTable);
  const [{ value: activeIslands }] = await db
    .select({ value: count() })
    .from(islandsTable)
    .where(eq(islandsTable.hasRescueStation, true));
  return {
    total: boats.length,
    available: boats.filter((boat) => boat.status === "available").length,
    onTrip: boats.filter((boat) => boat.status === "on_trip" || boat.status === "en_route").length,
    rescueReady: boats.filter((boat) => boat.emergencyEquipped && boat.status === "available").length,
    activeIslands: Number(activeIslands),
  };
}

export function haversineKm(a: Coordinate, b: Coordinate): number {
  const earthRadius = 6371;
  const latDelta = ((b.lat - a.lat) * Math.PI) / 180;
  const lngDelta = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const value =
    Math.sin(latDelta / 2) ** 2 +
    Math.sin(lngDelta / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export async function findNearestRescueBoat(position: Coordinate): Promise<FleetBoat | undefined> {
  const boats = await listApiBoats({ emergencyEquipped: true, status: "available" });
  return boats.sort(
    (a, b) => haversineKm(position, a.position) - haversineKm(position, b.position),
  )[0];
}

export function normalizeTripDate(value: Date): string {
  return value.toISOString();
}