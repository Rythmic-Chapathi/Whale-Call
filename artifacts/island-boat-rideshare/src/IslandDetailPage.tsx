import { useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Link, useParams } from 'wouter';
import { getListIslandsQueryKey, useListIslands } from '@workspace/api-client-react';
import { islandContent } from '@/islandContent';
import NotFound from '@/pages/not-found';

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(radians(a.lat)) * Math.cos(radians(b.lat));
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function IslandImage({ src, alt, label, width, height, className = '', eager = false }: { src: string; alt: string; label: string; width: number; height: number; className?: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className={`grid place-items-center bg-[#f6f6f6] p-4 text-center text-sm font-semibold text-muted-foreground ${className}`} style={{ aspectRatio: `${width} / ${height}` }} role="img" aria-label={`${label} image unavailable`}>{label}</div>;
  return <img src={src} alt={alt} width={width} height={height} loading={eager ? 'eager' : 'lazy'} onError={() => setFailed(true)} className={className} />;
}

export function IslandDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { data: islands, isLoading, isError, refetch } = useListIslands({ query: { queryKey: getListIslandsQueryKey() } });
  const island = islands?.find(item => item.id === id);
  const content = island ? islandContent[island.id] : undefined;

  if (isLoading) return <main className="grid min-h-[100dvh] place-items-center bg-background px-5"><p className="text-sm font-semibold text-muted-foreground">Loading island guide…</p></main>;
  if (isError) return <main className="grid min-h-[100dvh] place-items-center bg-background px-5"><div className="text-center"><h1 className="font-display text-4xl font-semibold">Islands are unavailable.</h1><button type="button" onClick={() => refetch()} className="focus-ring mt-6 min-h-11 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground">Reload islands</button></div></main>;
  if (!island || !content) return <NotFound />;

  const nearby = (islands ?? []).filter(other => other.id !== island.id).map(other => ({ island: other, km: distanceKm(island.center, other.center) })).sort((a, b) => a.km - b.km).slice(0, 3);
  const bookHref = `/book?destinationIsland=${encodeURIComponent(island.id)}`;
  const logoSrc = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/whale-call-logo.png`;

  return <div className="min-h-[100dvh] bg-background text-foreground">
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl"><div className="mx-auto flex h-[76px] max-w-[1180px] items-center justify-between px-5 lg:px-8"><Link href="/" className="focus-ring flex items-center gap-3"><img src={logoSrc} alt="" width={40} height={40} className="h-10 w-10 rounded-xl object-contain" /><span className="font-display text-xl font-semibold">Whale Call</span></Link><Link href="/book" className="focus-ring inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground">Book a ride</Link></div></header>
    <main>
      <section className="border-b border-border bg-card px-5 py-12 lg:px-8 lg:py-16"><div className="mx-auto max-w-[1180px]">
        <Link href="/" className="focus-ring inline-flex min-h-11 items-center gap-2 text-sm font-bold text-muted-foreground"><ArrowRight className="rotate-180" size={15} />All islands</Link>
        <div className="mt-7 flex flex-wrap items-end justify-between gap-5"><div><h1 className="font-display text-5xl font-semibold tracking-[-.055em] sm:text-7xl">{island.name}</h1><p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{island.tagline}</p><p className="mt-5 max-w-3xl text-base leading-7 text-foreground/80">{content.intro}</p></div>{island.hasRescueStation && <span className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-4 py-2 text-sm font-bold text-primary"><ShieldCheck size={17} />Rescue station on island</span>}</div>
        <div className="mt-10 grid gap-3 sm:grid-cols-3">{content.heroImages.map((image, index) => <IslandImage key={image.src} {...image} label={island.name} width={1200} height={675} eager={index === 0} className="aspect-video w-full rounded-xl object-cover shadow-sm" />)}</div>
      </div></section>

      <section className="mx-auto max-w-[1180px] px-5 py-14 lg:px-8 lg:py-20"><h2 className="font-display text-4xl font-semibold tracking-[-.04em]">Things to do</h2><div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{content.highlights.map(item => <article key={item.name} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"><IslandImage src={item.image} alt={item.alt} label={item.name} width={900} height={675} className="aspect-[4/3] w-full object-cover" /><div className="p-5"><h3 className="font-display text-2xl font-semibold">{item.name}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p></div></article>)}</div></section>

      <section className="bg-muted px-5 py-14 lg:px-8 lg:py-20"><div className="mx-auto grid max-w-[1180px] gap-12 lg:grid-cols-2">
        <div><h2 className="font-display text-4xl font-semibold">Good to know</h2><div className="mt-7 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">{content.goodToKnow.map(fact => <div key={fact.label} className="p-5"><p className="font-mono-ui text-[10px] uppercase tracking-[.14em] text-primary">{fact.label}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{fact.text}</p></div>)}</div></div>
        <div><h2 className="font-display text-4xl font-semibold">Getting here</h2><p className="mt-4 text-sm leading-6 text-muted-foreground">Times use the booking distance calculation and a standard 32 km/h water-taxi cruising speed.</p><div className="mt-7 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">{nearby.map(({ island: other, km }) => <div key={other.id} className="flex items-center justify-between gap-4 p-5"><Link href={`/islands/${other.id}`} className="focus-ring font-semibold">{other.name}</Link><div className="text-right"><p className="font-display text-2xl font-semibold">{km.toFixed(1)} km</p><p className="text-xs text-muted-foreground">{Math.max(3, Math.ceil(km / 32 * 60))} min by boat</p></div></div>)}</div></div>
      </div></section>

      <section className="mx-auto max-w-[1180px] px-5 py-14 lg:px-8 lg:py-20"><h2 className="font-display text-4xl font-semibold">Where to land</h2><p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">Choose the dock closest to the part of {island.name} you want to explore first.</p><div className="mt-7 grid gap-4 md:grid-cols-2">{island.docks.map(dock => <div key={dock.id} className="flex flex-col justify-between gap-5 rounded-xl border border-border bg-card p-5 shadow-sm"><div><h3 className="font-display text-2xl font-semibold">{dock.name}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{content.dockNotes[dock.id]}</p></div><Link href={`${bookHref}&destinationDock=${encodeURIComponent(dock.id)}`} className="focus-ring inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground" data-testid={`link-book-dock-${dock.id}`}>Book a ride here <ArrowRight size={15} /></Link></div>)}</div></section>

      <section className="mx-auto max-w-[1180px] px-5 py-14 lg:px-8 lg:py-20"><div className="flex flex-wrap items-center justify-between gap-5 rounded-[28px] bg-primary p-7 text-primary-foreground sm:p-10"><div><h2 className="font-display text-4xl font-semibold">Book a ride to {island.name}</h2><p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/70">Choose your departure dock next. We will keep this destination ready.</p></div><Link href={bookHref} className="focus-ring sticky bottom-4 z-10 inline-flex min-h-12 items-center gap-2 rounded-full bg-secondary px-6 py-3.5 text-sm font-extrabold text-sidebar shadow-xl sm:static" data-testid={`link-book-island-${island.id}`}>Book a ride to {island.name} <ArrowRight size={17} /></Link></div>
        <div className="mt-14"><h2 className="font-display text-4xl font-semibold">Nearby islands</h2><div className="mt-7 grid gap-4 sm:grid-cols-3">{nearby.map(({ island: other }) => <Link key={other.id} href={`/islands/${other.id}`} className="group focus-ring rounded-2xl border border-border bg-card p-5 shadow-sm transition-transform hover:-translate-y-1"><h3 className="font-display text-2xl font-semibold">{other.name}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{other.tagline}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary">View island <ArrowRight size={15} /></span></Link>)}</div></div>
      </section>
    </main>
    <footer className="border-t border-sidebar-border bg-sidebar px-5 py-10 text-center text-sm text-sidebar-foreground/70">Island photography: <a href="https://unsplash.com" target="_blank" rel="noreferrer" className="underline underline-offset-4">{content.photographerCredit}</a></footer>
  </div>;
}