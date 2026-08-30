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
  className?: string;
};

function boatMarkerSvg(color: string, heading: number) {
  return `<svg width="42" height="42" viewBox="0 0 42 42" aria-hidden="true" style="transform:rotate(${heading}deg)">
    <circle cx="21" cy="21" r="19" fill="white" stroke="${color}" stroke-width="2"/>
    <path d="M21 8l8 22-8 4-8-4 8-22z" fill="${color}"/>
    <path d="M17 23h8M18.5 27h5" stroke="white" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}

export function CaribbeanMap({
  islands,
  boats = [],
  pickupId,
  destinationId,
  targetPosition,
  emergency = false,
  className = '',
}: CaribbeanMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    let map: L.Map;
    try {
      map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
        preferCanvas: true,
      }).setView([17.8, -62.75], 7.1);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        tileSize: 256,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);
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
        html: boatMarkerSvg(color, boat.heading),
        iconSize: [42, 42],
        iconAnchor: [21, 21],
      });
      L.marker([boat.position.lat, boat.position.lng], { icon, title: `${boat.name} · ${boat.status.replace('_', ' ')}` }).addTo(markerGroup);
    }

    const pickup = islands.find(island => island.id === pickupId)?.center;
    const destination = islands.find(island => island.id === destinationId)?.center;
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
        animate: true,
      });
    }
    window.setTimeout(() => map.invalidateSize(), 100);

    return () => {
      markerGroup.clearLayers();
      map.remove();
    };
  }, [boats, destinationId, emergency, islands, pickupId, targetPosition]);

  if (mapError) {
    return <div className={`map-grid grid min-h-[320px] place-items-center rounded-xl border border-border ${className}`}><div className="max-w-sm px-6 text-center"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-primary">OpenStreetMap operating area</p><p className="mt-2 text-sm font-semibold">{islands.map(island => island.name).join(' · ')}</p><p className="mt-3 text-xs leading-5 text-muted-foreground">Interactive chart unavailable in this browser. Port and fleet data remain available.</p></div></div>;
  }

  return (
    <div className={`relative min-h-[320px] overflow-hidden rounded-xl border border-border bg-muted ${className}`} data-testid="caribbean-map" aria-label="OpenStreetMap view of Caribbean islands, ports, and fleet">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-lg border border-border bg-card/95 px-3 py-2 shadow-md backdrop-blur">
        <p className="font-mono-ui text-[9px] uppercase tracking-[.14em] text-primary">Whale Call operating area</p>
        <p className="mt-1 text-xs font-semibold">OpenStreetMap · live ports · SVG fleet markers</p>
      </div>
    </div>
  );
}