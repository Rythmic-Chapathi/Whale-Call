import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
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

const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

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
    if (!containerRef.current || !token) return;
    mapboxgl.accessToken = token;
    let map: mapboxgl.Map;
    try {
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: emergency ? 'mapbox://styles/mapbox/navigation-night-v1' : 'mapbox://styles/mapbox/navigation-day-v1',
        center: [-62.75, 17.8],
        zoom: 7.1,
        attributionControl: true,
      });
    } catch {
      setMapError(true);
      return;
    }
    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right');

    const markers: mapboxgl.Marker[] = [];
    for (const island of islands) {
      for (const dock of island.docks ?? []) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'port-marker';
        el.setAttribute('aria-label', `${dock.name}, ${island.name}`);
        el.innerHTML = '<span></span>';
        el.title = `${dock.name} · ${island.name}`;
        markers.push(new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([dock.position.lng, dock.position.lat]).addTo(map));
      }
    }
    for (const boat of boats.slice(0, 30)) {
      const el = document.createElement('div');
      el.className = 'boat-map-marker';
      el.innerHTML = boatMarkerSvg(emergency ? '#FF3B30' : boat.status === 'available' ? '#14919B' : '#5A6B74', boat.heading);
      el.title = `${boat.name} · ${boat.status.replace('_', ' ')}`;
      markers.push(new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([boat.position.lng, boat.position.lat]).addTo(map));
    }

    map.on('load', () => {
      const pickup = islands.find(island => island.id === pickupId)?.center;
      const destination = islands.find(island => island.id === destinationId)?.center;
      const points = [pickup, destination, targetPosition].filter(Boolean) as Coordinate[];
      if (points.length >= 2) {
        map.addSource('active-route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: points.map(point => [point.lng, point.lat]) },
          },
        });
        map.addLayer({
          id: 'active-route-line',
          type: 'line',
          source: 'active-route',
          paint: {
            'line-color': emergency ? '#FF3B30' : '#14919B',
            'line-width': 4,
            'line-dasharray': [1.5, 1.5],
          },
        });
        const bounds = new mapboxgl.LngLatBounds();
        points.forEach(point => bounds.extend([point.lng, point.lat]));
        map.fitBounds(bounds, { padding: { top: 70, right: 70, bottom: 110, left: 70 }, duration: 500, maxZoom: 11 });
      }
    });

    return () => {
      markers.forEach(marker => marker.remove());
      map.remove();
    };
  }, [boats, destinationId, emergency, islands, pickupId, targetPosition]);

  if (!token || mapError) {
    return <div className={`map-grid grid min-h-[320px] place-items-center rounded-xl border border-border ${className}`}><div className="max-w-sm px-6 text-center"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-primary">Caribbean operating area</p><p className="mt-2 text-sm font-semibold">{islands.map(island => island.name).join(' · ')}</p><p className="mt-3 text-xs leading-5 text-muted-foreground">{mapError ? 'Interactive chart unavailable because this browser does not support WebGL.' : 'Map service is temporarily unavailable.'} Port and fleet data remain available.</p></div></div>;
  }

  return (
    <div className={`relative min-h-[320px] overflow-hidden rounded-xl border border-border bg-muted ${className}`} data-testid="caribbean-map" aria-label="Live Caribbean islands, ports, and fleet map">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-border bg-card/95 px-3 py-2 shadow-md backdrop-blur">
        <p className="font-mono-ui text-[9px] uppercase tracking-[.14em] text-primary">Whale Call operating area</p>
        <p className="mt-1 text-xs font-semibold">Live ports · SVG fleet markers</p>
      </div>
    </div>
  );
}