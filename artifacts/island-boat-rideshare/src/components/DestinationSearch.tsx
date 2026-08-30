import { useEffect, useMemo, useState } from 'react';
import { LoaderCircle, MapPin, Search, X } from 'lucide-react';
import { getSearchLocationsQueryKey, useSearchLocations } from '@workspace/api-client-react';
import type { Dock, Island, LocationSearchResult } from '@workspace/api-client-react';

type DestinationMatch = {
  result: LocationSearchResult;
  island: Island;
  dock: Dock;
  isDepartureIsland: boolean;
};

type DestinationSearchProps = {
  islands: Island[];
  departureIslandId?: string;
  onSelect: (match: DestinationMatch) => void;
};

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.sin(dLng / 2) ** 2 * Math.cos(radians(a.lat)) * Math.cos(radians(b.lat));
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function nearestDestination(result: LocationSearchResult, islands: Island[], departureIslandId?: string): DestinationMatch | undefined {
  const location = { lat: result.lat, lng: result.lng };
  let nearest: DestinationMatch | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const island of islands) {
    for (const dock of island.docks) {
      const distance = distanceKm(location, dock.position);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = { result, island, dock, isDepartureIsland: island.id === departureIslandId };
      }
    }
  }
  return nearest;
}

export function DestinationSearch({ islands, departureIslandId, onSelect }: DestinationSearchProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 800);
    return () => window.clearTimeout(timer);
  }, [query]);

  const canSearch = debouncedQuery.length >= 2;
  const searchParams = useMemo(
    () => ({ q: canSearch ? debouncedQuery : 'none', limit: 5 }),
    [canSearch, debouncedQuery],
  );
  const search = useSearchLocations(
    searchParams,
    { query: { enabled: canSearch, retry: false, staleTime: 5 * 60_000, queryKey: getSearchLocationsQueryKey(searchParams) } },
  );
  const matches = useMemo(
    () => (search.data ?? [])
      .map(result => nearestDestination(result, islands, departureIslandId))
      .filter((match): match is DestinationMatch => Boolean(match)),
    [departureIslandId, islands, search.data],
  );

  return (
    <div className="relative">
      <label className="grid gap-2 text-sm font-bold" htmlFor="destination-place-search">
        Search a real place
        <span className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
          <input
            id="destination-place-search"
            type="search"
            value={query}
            onChange={event => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Try Antigua, Marigot, or Gustavia"
            autoComplete="off"
            className="focus-ring w-full rounded-2xl border border-border bg-background py-3.5 pl-11 pr-11 font-semibold placeholder:text-muted-foreground"
            data-testid="input-destination-search"
          />
          {search.isFetching
            ? <LoaderCircle className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-primary" size={17} aria-label="Searching locations" />
            : query && <button type="button" onClick={() => { setQuery(''); setDebouncedQuery(''); setOpen(false); }} className="focus-ring absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted" aria-label="Clear location search"><X size={15} /></button>}
        </span>
      </label>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">Search powered by Nominatim, then choose the nearest Whale Call arrival dock.</p>

      {open && canSearch && (
        <div className="absolute left-0 right-0 top-full z-[1200] mt-2 overflow-hidden rounded-2xl border border-border bg-card shadow-xl" data-testid="destination-search-results">
          {search.isError && <p className="p-4 text-sm text-destructive">Location search is resting. Try again in a moment.</p>}
          {!search.isFetching && !search.isError && matches.length === 0 && <p className="p-4 text-sm text-muted-foreground">No matching place in the Whale Call operating area.</p>}
          {matches.map(match => (
            <button
              type="button"
              key={match.result.placeId}
              disabled={match.isDepartureIsland}
              onClick={() => {
                onSelect(match);
                setQuery(match.result.name);
                setOpen(false);
              }}
              className="focus-ring flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              data-testid={`button-destination-result-${match.result.placeId}`}
            >
              <MapPin className="mt-0.5 shrink-0 text-primary" size={17} />
              <span className="min-w-0">
                <span className="block text-sm font-extrabold">{match.result.name}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">{match.result.displayName}</span>
                <span className="mt-1 block text-[10px] font-bold uppercase tracking-[.08em] text-primary">
                  {match.isDepartureIsland ? 'Departure island — choose another place' : `${match.island.name} · ${match.dock.name}`}
                </span>
              </span>
            </button>
          ))}
          <p className="bg-muted px-4 py-2 text-[9px] text-muted-foreground">Location data © OpenStreetMap contributors</p>
        </div>
      )}
    </div>
  );
}