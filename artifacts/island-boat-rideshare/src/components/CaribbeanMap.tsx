import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { FleetBoat, Island } from '@workspace/api-client-react';

type Coordinate = { lat: number; lng: number };

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

const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;

function boatMarkerPng(color: string, heading: number) {
  const src = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/fleet/whale-call-boat.png`;
  const safeHeading = Number.isFinite(heading) ? ((heading % 360) + 360) % 360 : 0;
  return `<span class="boat-marker-frame" style="--boat-status:${color};--boat-heading:${safeHeading}deg" aria-hidden="true"><img src="${src}" alt="" /></span>`;
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
    try {
      map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
        preferCanvas: true,
      }).setView([17.8, -62.75], 7.1);
      if (mapboxToken) {
        const satelliteLayer = L.tileLayer(
          `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/512/{z}/{x}/{y}@2x?access_token=${encodeURIComponent(mapboxToken)}`,
          {
            tileSize: 512,
            zoomOffset: -1,
            maxZoom: 18,
            attribution: '&copy; Mapbox &copy; OpenStreetMap',
          },
        );
        satelliteLayer.on('tileerror', () => setMapError(true));
        satelliteLayer.addTo(map);
      }
    } catch {
      setMapError(true);
      return;
    }

    const markerGroup = L.layerGroup().addTo(map);
    for (const island of islands) {
      for (const dock of island.docks ?? []) {
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
    for (const boat of boats.slice(0, 30)) {
      const color = emergency ? '#FF3B30' : boat.status === 'available' ? '#14919B' : '#5A6B74';
      const icon = L.divIcon({
        className: 'boat-map-marker',
        html: boatMarkerPng(color, boat.heading),
        iconSize: [58, 42],
        iconAnchor: [29, 21],
      });
      L.marker([boat.position.lat, boat.position.lng], { icon, title: `${boat.name} · ${boat.status.replace('_', ' ')}` }).addTo(markerGroup);
    }
    for (const island of islands) {
      const selected = island.id === pickupId || island.id === destinationId;
      const nudge = islandLabelNudges[island.id] ?? { lat: 0.04, lng: 0 };
      const labelPosition = { lat: island.center.lat + nudge.lat, lng: island.center.lng + nudge.lng };
      const shapeIcon = L.divIcon({
        className: 'island-shape-icon',
        html: `<button type="button" role="link" tabindex="0" class="island-shape-button${selected ? ' island-shape-selected' : ''}" aria-label="View ${escapeHtml(island.name)}"><span aria-hidden="true"></span></button>`,
        iconSize: [42, 28],
        iconAnchor: [21, 14],
      });
      L.marker([island.center.lat, island.center.lng], { icon: shapeIcon, title: `View ${island.name}`, zIndexOffset: 500 })
        .on('click', () => onIslandClickRef.current?.(island.id))
        .addTo(markerGroup);
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

    const pickupIsland = islands.find(island => island.id === pickupId);
    const destinationIsland = islands.find(island => island.id === destinationId);
    const pickup = pickupIsland?.docks?.[0]?.position ?? pickupIsland?.center;
    const destination = destinationIsland?.docks?.[0]?.position ?? destinationIsland?.center;
    const points = [pickup, destination, targetPosition].filter(Boolean) as Coordinate[];
    if (points.length >= 2) {
      L.polyline(points.map(point => [point.lat, point.lng] as [number, number]), {
        color: emergency ? '#FF3B30' : '#14919B',
        weight: 4,
        dashArray: '8 8',
        opacity: 0.9,
      }).addTo(map);
      map.fitBounds(L.latLngBounds(points.map(point => [point.lat, point.lng])), {
        padding: [70, 70],
        maxZoom: 11,
        // Boat/trip polling can rebuild this effect while Leaflet is still
        // animating. A non-animated fit avoids callbacks firing on a removed
        // map pane in the proxied preview browser.
        animate: false,
      });
    }
    const resizeTimer = window.setTimeout(() => {
      if (!map.getContainer().isConnected) return;
      map.invalidateSize({ animate: false });
    }, 100);

    return () => {
      window.clearTimeout(resizeTimer);
      map.stop();
      markerGroup.clearLayers();
      map.remove();
    };
  }, [boats, destinationId, emergency, islands, pickupId, targetPosition]);

  if (mapError) {
    return <div className={`caribbean-map map-grid grid place-items-center rounded-xl border border-border ${className}`}><div className="max-w-sm px-6 text-center"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-primary">Whale Call operating area</p><p className="mt-2 text-sm font-semibold">{islands.map(island => island.name).join(' · ')}</p><p className="mt-3 text-xs leading-5 text-muted-foreground">Interactive chart unavailable in this browser. Port and route data remain available.</p></div></div>;
  }

  return (
    <div className={`caribbean-map relative overflow-hidden rounded-xl border border-border bg-muted ${className}`} data-testid="caribbean-map" aria-label="Interactive chart of Caribbean islands, ports, and routes">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-lg border border-border bg-card/95 px-3 py-2 shadow-md backdrop-blur">
        <p className="font-mono-ui text-[9px] uppercase tracking-[.14em] text-primary">Whale Call operating area</p>
        <p className="mt-1 text-xs font-semibold">{mapboxToken ? 'Mapbox satellite · live ports · shared route view' : 'Island chart · live ports · shared route view'}</p>
      </div>
    </div>
  );
}