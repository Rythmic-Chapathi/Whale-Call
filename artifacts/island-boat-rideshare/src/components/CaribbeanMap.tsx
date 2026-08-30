import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { FleetBoat, Island } from '@workspace/api-client-react';

type Coordinate = { lat: number; lng: number };

type BoatMotion = {
  marker: L.Marker;
  origin: Coordinate;
  radiusLat: number;
  radiusLng: number;
  phase: number;
  speed: number;
  pattern: 0 | 1 | 2;
};

type CaribbeanMapProps = {
  islands: Island[];
  boats?: FleetBoat[];
  pickupId?: string;
  destinationId?: string;
  targetPosition?: Coordinate;
  emergency?: boolean;
  onIslandClick?: (islandId: string) => void;
  className?: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character));
}

const islandLabelNudges: Record<string, { lat: number; lng: number }> = {
  "coral-cove": { lat: 0.035, lng: 0 },
  "pelican-key": { lat: 0.04, lng: 0.035 },
  "mango-harbor": { lat: 0.035, lng: -0.015 },
  "starfish-bay": { lat: 0.04, lng: -0.025 },
  "lighthouse-isle": { lat: 0.045, lng: -0.06 },
  "turtle-point": { lat: 0.04, lng: 0.03 },
  "driftwood-island": { lat: 0.045, lng: 0.08 },
};

const rawMapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;
const mapboxToken = typeof rawMapboxToken === 'string' && /^pk\.[A-Za-z0-9._-]+$/.test(rawMapboxToken.trim())
  ? rawMapboxToken.trim()
  : undefined;

function boatMarkerPng(color: string, heading: number = 0) {
  const src = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/boat.png`;
  const safeHeading = Number.isFinite(heading) ? ((heading % 360) + 360) % 360 : 0;
  return `<span class="boat-marker-frame" style="--boat-status:${color};--boat-heading:${safeHeading}deg" aria-hidden="true"><img src="${src}" alt="" /></span>`;
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function isOpenWater(position: Coordinate, islands: Island[]) {
  return islands.every(island => {
    const center = island.center;
    if (center) {
      const latDistance = position.lat - center.lat;
      const lngDistance = (position.lng - center.lng) * Math.cos((center.lat * Math.PI) / 180);
      if (Math.hypot(latDistance, lngDistance) < 0.032) return false;
    }
    return (island.docks ?? []).every(dock => {
      if (!dock.position) return true;
      const latDistance = position.lat - dock.position.lat;
      const lngDistance = (position.lng - dock.position.lng) * Math.cos((dock.position.lat * Math.PI) / 180);
      return Math.hypot(latDistance, lngDistance) >= 0.014;
    });
  });
}

export function CaribbeanMap({
  islands,
  boats = [],
  pickupId,
  destinationId,
  targetPosition,
  emergency = false,
  onIslandClick,
  className = '',
}: CaribbeanMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onIslandClickRef = useRef(onIslandClick);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    onIslandClickRef.current = onIslandClick;
  }, [onIslandClick]);

  useEffect(() => {
    if (!containerRef.current) return;
    let map: L.Map;
    let tileLayer: L.TileLayer;

    try {
      map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
        preferCanvas: true,
      }).setView([17.8, -62.75], 7.1);

      if (mapboxToken) {
        tileLayer = L.tileLayer(
          `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/512/{z}/{x}/{y}@2x?access_token=${encodeURIComponent(mapboxToken)}`,
          {
            tileSize: 512,
            zoomOffset: -1,
            maxZoom: 18,
          }
        );
      } else {
        tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
        });
      }

      tileLayer.on('tileerror', () => {
        tileLayer.removeFrom(map);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
      });

      tileLayer.addTo(map);
    } catch {
      setMapError(true);
      return;
    }

    const markerGroup = L.layerGroup().addTo(map);

    // 1. Docks & Ports
    for (const island of islands) {
      for (const dock of island.docks ?? []) {
        if (!dock.position?.lat || !dock.position?.lng) continue;
        const icon = L.divIcon({
          className: 'port-marker-icon',
          html: '<span></span>',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        L.marker([dock.position.lat, dock.position.lng], { icon, title: `${dock.name}, ${island.name}` })
          .bindTooltip(`${dock.name} · ${island.name}`, { direction: 'top', offset: [0, -8] })
          .addTo(markerGroup);
      }
    }

    // 2. Active vessels
    const boatMotions: BoatMotion[] = [];

    for (const boat of boats) {
      const lat = boat.position?.lat ?? (boat as any).lat ?? (boat as any).latitude;
      const lng = boat.position?.lng ?? (boat as any).lng ?? (boat as any).longitude;

      if (typeof lat !== 'number' || typeof lng !== 'number') continue;

      const status = boat.status ?? 'available';
      const color = emergency ? '#FF3B30' : status === 'available' ? '#14919B' : '#5A6B74';

      const icon = L.divIcon({
        className: 'boat-map-marker',
        html: boatMarkerPng(color, boat.heading ?? 0),
        iconSize: [58, 42],
        iconAnchor: [29, 21],
      });

      const marker = L.marker([lat, lng], {
        icon,
        title: `${boat.name ?? 'Vessel'} · ${status.replace('_', ' ')}`,
        zIndexOffset: 2000,
      }).addTo(markerGroup);
      const seed = hashString(boat.id ?? boat.name ?? `boat-${boatMotions.length}`);
      boatMotions.push({
        marker,
        origin: { lat, lng },
        radiusLat: 0.009 + ((seed >>> 8) % 6) * 0.0012,
        radiusLng: 0.013 + ((seed >>> 12) % 6) * 0.0018,
        phase: (seed % 628) / 100,
        speed: 0.34 + ((seed >>> 16) % 7) * 0.035,
        pattern: (seed % 3) as BoatMotion['pattern'],
      });
    }

    let animationFrame = 0;
    let animationStopped = false;
    const animationStart = performance.now();
    const animateBoats = (now: number) => {
      if (animationStopped || !map.getContainer().isConnected) return;
      const elapsed = (now - animationStart) / 1000;
      for (const motion of boatMotions) {
        const time = elapsed * motion.speed + motion.phase;
        const candidate = motion.pattern === 0
          ? {
              lat: motion.origin.lat + Math.sin(time * 2) * motion.radiusLat * 0.55,
              lng: motion.origin.lng + Math.sin(time) * motion.radiusLng,
            }
          : motion.pattern === 1
            ? {
                lat: motion.origin.lat + Math.cos(time) * motion.radiusLat,
                lng: motion.origin.lng + Math.sin(time) * motion.radiusLng,
              }
            : {
                lat: motion.origin.lat + Math.cos(time * 0.7) * motion.radiusLat * 0.8,
                lng: motion.origin.lng + (Math.sin(time) + Math.sin(time * 0.45) * 0.35) * motion.radiusLng * 0.75,
              };
        motion.marker.setLatLng(isOpenWater(candidate, islands) ? candidate : motion.origin);
      }
      animationFrame = window.requestAnimationFrame(animateBoats);
    };
    animationFrame = window.requestAnimationFrame(animateBoats);

    // 3. Island Labels Only (White shape buttons removed)
    for (const island of islands) {
      if (!island.center?.lat || !island.center?.lng) continue;

      const selected = island.id === pickupId || island.id === destinationId;
      const nudge = islandLabelNudges[island.id] ?? { lat: 0.04, lng: 0 };
      const labelPosition = { lat: island.center.lat + nudge.lat, lng: island.center.lng + nudge.lng };

      const icon = L.divIcon({
        className: 'island-label-icon',
        html: `<button type="button" role="link" tabindex="0" class="island-label-button${selected ? ' island-label-selected' : ''}" aria-label="View ${escapeHtml(island.name)}">${escapeHtml(island.name)}</button>`,
        iconSize: [112, 20],
        iconAnchor: [56, -7],
      });

      L.marker([labelPosition.lat, labelPosition.lng], { icon, title: `View ${island.name}`, zIndexOffset: 1000 })
        .on('click', () => onIslandClickRef.current?.(island.id))
        .addTo(markerGroup);
    }

    // 4. Planned Route Polyline
    const pickupIsland = islands.find(island => island.id === pickupId);
    const destinationIsland = islands.find(island => island.id === destinationId);
    const pickup = pickupIsland?.docks?.[0]?.position ?? pickupIsland?.center;
    const destination = destinationIsland?.docks?.[0]?.position ?? destinationIsland?.center;
    const points = [pickup, destination, targetPosition].filter(
      (point): point is Coordinate => Boolean(point?.lat && point?.lng)
    );

    if (points.length >= 2) {
      L.polyline(
        points.map(point => [point.lat, point.lng] as [number, number]),
        {
          color: emergency ? '#FF3B30' : '#14919B',
          weight: 4,
          dashArray: '8 8',
          opacity: 0.9,
        }
      ).addTo(map);

      map.fitBounds(L.latLngBounds(points.map(point => [point.lat, point.lng])), {
        padding: [70, 70],
        maxZoom: 11,
        animate: false,
      });
    }

    const resizeTimer = window.setTimeout(() => {
      if (!map.getContainer().isConnected) return;
      map.invalidateSize({ animate: false });
    }, 100);

    return () => {
      animationStopped = true;
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(resizeTimer);
      map.stop();
      markerGroup.clearLayers();
      map.remove();
    };
  }, [boats, destinationId, emergency, islands, pickupId, targetPosition]);

  if (mapError) {
    return (
      <div className={`caribbean-map map-grid grid place-items-center rounded-xl border border-border ${className}`}>
        <div className="max-w-sm px-6 text-center">
          <p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-primary">Whale Call operating area</p>
          <p className="mt-2 text-sm font-semibold">{islands.map(island => island.name).join(' · ')}</p>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">Interactive chart unavailable in this browser.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`caribbean-map relative overflow-hidden rounded-xl border border-border bg-muted ${className}`}
      data-testid="caribbean-map"
      aria-label="Interactive chart of Caribbean islands, ports, and routes"
    >
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  );
}