import { createContext, useContext, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { shadcn } from '@clerk/themes';
import { Link, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import {
  Anchor, ArrowRight, BadgeCheck, Binoculars, BookOpen, Check, ChevronDown,
  CircleAlert, CircleCheck, Compass, Crosshair, HeartHandshake,
  LifeBuoy, LogOut, Menu, Navigation, Phone, Radio, Sailboat, ShieldCheck,
  Star, Waves, X,
} from 'lucide-react';
import {
  BoatClass, BoatStatus, EmergencySituation, getGetEmergencyQueryKey, getGetFleetBoatQueryKey, getGetFleetSummaryQueryKey,
  getGetTripQueryKey, getListFleetQueryKey, getListIslandsQueryKey, getHealthCheckQueryKey,
  useCompleteTrip, useCreateEmergency, useCreateTrip, useGetEmergency, useGetFleetSummary,
  useGetFleetBoat, useGetTrip, useHealthCheck, useListFleet, useListIslands, useResolveEmergency,
} from '@workspace/api-client-react';
import type { Dock, FleetBoat, Island, TripInput } from '@workspace/api-client-react';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000 } } });
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const logoSrc = `${basePath || ''}/whale-call-logo.png`;
const shellNav = [
  { href: '/', label: 'Book a crossing', icon: Navigation },
  { href: '/fleet', label: 'The live fleet', icon: Sailboat },
  { href: '/profile', label: 'Your logbook', icon: BookOpen },
];
type UserSummary = { firstName?: string | null; fullName?: string | null; primaryEmailAddress?: { emailAddress?: string | null } | null };
type AuthUi = { signedIn: boolean; loaded: boolean; user: UserSummary | null; signOut: () => void };
const AuthUiContext = createContext<AuthUi>({ signedIn: false, loaded: true, user: null, signOut: () => undefined });
const useAuthUi = () => useContext(AuthUiContext);

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

function Logo({ compact = false, dark = false }: { compact?: boolean; dark?: boolean }) {
  return (
    <Link href="/" className="focus-ring flex items-center gap-3" data-testid="link-logo">
      <img src={logoSrc} alt="Whale Call" className={`shrink-0 object-contain ${compact ? 'h-9 w-9' : 'h-10 w-10 rounded-[14px]'}`} />
      {!compact && <span className={`font-display text-[21px] font-semibold tracking-[-.03em] ${dark ? 'text-sidebar-foreground' : 'text-foreground'}`}>Whale Call</span>}
    </Link>
  );
}

function Button({ children, kind = 'primary', className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'primary' | 'secondary' | 'quiet' | 'danger' }) {
  const styles = {
    primary: 'bg-primary text-primary-foreground shadow-sm hover:-translate-y-0.5 hover:shadow-md',
    secondary: 'bg-secondary text-secondary-foreground hover:-translate-y-0.5 hover:shadow-md',
    quiet: 'border border-border bg-card text-foreground hover:bg-muted',
    danger: 'bg-destructive text-destructive-foreground hover:-translate-y-0.5',
  };
  return <button {...props} className={`focus-ring inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${styles[kind]} ${className}`}>{children}</button>;
}

function LoadingCard({ label = 'Checking the tide' }: { label?: string }) {
  return <div className="grid min-h-[260px] place-items-center rounded-[28px] border border-border bg-card p-8 text-center shadow-sm" data-testid="state-loading">
    <div><div className="mx-auto mb-4 h-10 w-10 animate-pulse rounded-full bg-secondary/70" /><p className="font-mono-ui text-xs uppercase tracking-[.16em] text-muted-foreground">{label}</p></div>
  </div>;
}

function ErrorCard({ retry, message = 'The radio went quiet for a moment.' }: { retry?: () => void; message?: string }) {
  return <div className="rounded-[28px] border border-destructive/25 bg-destructive/5 p-8 text-center" data-testid="state-error">
    <CircleAlert className="mx-auto mb-3 text-destructive" size={28} /><h3 className="font-display text-2xl">A small squall.</h3><p className="mt-2 text-sm text-muted-foreground">{message}</p>
    {retry && <Button kind="quiet" onClick={retry} className="mt-5" data-testid="button-retry">Try again</Button>}
  </div>;
}

function ModePill({ emergency = false }: { emergency?: boolean }) {
  return <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-mono-ui text-[10px] uppercase tracking-[.17em] ${emergency ? 'bg-destructive/10 text-destructive' : 'bg-secondary/20 text-primary'}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${emergency ? 'bg-destructive' : 'bg-accent'}`} />{emergency ? 'Response mode' : 'Voyage mode'}
  </span>;
}

function AppShell({ children, emergency = false }: { children: ReactNode; emergency?: boolean }) {
  const [open, setOpen] = useState(false);
  const auth = useAuthUi();
  return <div className={`min-h-[100dvh] texture ${emergency ? 'bg-[#f8eeeb]' : 'bg-background'}`}>
    <header className={`sticky top-0 z-40 border-b backdrop-blur-xl ${emergency ? 'border-destructive/15 bg-[#f8eeeb]/90' : 'border-border/70 bg-background/85'}`}>
      <div className="mx-auto flex h-[76px] max-w-[1240px] items-center justify-between px-5 lg:px-8">
        <div className="flex items-center gap-10"><Logo /><nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          {shellNav.map(item => <Link key={item.href} href={item.href} className="focus-ring rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" data-testid={`link-nav-${item.label.toLowerCase().replaceAll(' ', '-')}`}>{item.label}</Link>)}
        </nav></div>
        <div className="flex items-center gap-3">
          <ModePill emergency={emergency} />
          {!auth.signedIn && <><Link href="/sign-in" className="hidden rounded-full px-4 py-2 text-sm font-bold text-foreground hover:bg-muted sm:inline-flex" data-testid="link-sign-in">Sign in</Link><Link href="/sign-up" className="hidden rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground sm:inline-flex" data-testid="link-sign-up">Create account</Link></>}
          {auth.signedIn && <><Link href="/profile" className="focus-ring hidden items-center gap-2 rounded-full border border-border bg-card py-1.5 pl-1.5 pr-3 text-sm font-bold sm:flex" data-testid="link-user-profile"><span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs text-primary-foreground">{auth.user?.firstName?.[0] ?? 'A'}</span>{auth.user?.firstName ?? 'Captain'}</Link><button type="button" onClick={auth.signOut} className="hidden p-2 text-muted-foreground hover:text-foreground sm:block" data-testid="button-sign-out" aria-label="Sign out"><LogOut size={17} /></button></>}
          <button type="button" className="rounded-full p-2 hover:bg-muted md:hidden" onClick={() => setOpen(!open)} data-testid="button-open-menu" aria-label="Open navigation">{open ? <X size={21} /> : <Menu size={21} />}</button>
        </div>
      </div>
      {open && <nav className="border-t border-border px-5 py-3 md:hidden">{shellNav.map(item => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="block border-b border-border/70 py-3 text-sm font-semibold" data-testid={`link-mobile-${item.label.toLowerCase().replaceAll(' ', '-')}`}>{item.label}</Link>)}<Link href="/emergency" className="block py-3 text-sm font-bold text-destructive" data-testid="link-mobile-emergency">Open Response mode</Link></nav>}
    </header>
    {children}
    <Link href="/emergency" className="focus-ring fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full border-2 border-destructive/20 bg-destructive px-4 py-3 text-xs font-extrabold tracking-wide text-white shadow-lg transition-transform hover:-translate-y-1" data-testid="link-emergency-float"><LifeBuoy size={16} />Need help on the water</Link>
  </div>;
}

function Footer() {
  const { data: health } = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey() } });
  return <footer className="border-t border-sidebar-border bg-sidebar px-5 py-12 text-sidebar-foreground lg:px-8"><div className="mx-auto grid max-w-[1240px] gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
    <div><Logo dark /><p className="mt-5 max-w-xs text-sm leading-6 text-sidebar-foreground/65">Local captains. Clear fares. A better way across the islands.</p><p className="mt-6 font-mono-ui text-[10px] uppercase tracking-[.18em] text-sidebar-foreground/45">Staying on channel · {health?.status === 'ok' ? 'All boats accounted for' : 'Coastwatch online'}</p></div>
    <div><p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-secondary">Navigate</p><div className="mt-4 grid gap-3 text-sm text-sidebar-foreground/70"><Link href="/fleet" data-testid="footer-fleet">The fleet</Link><Link href="/profile" data-testid="footer-profile">Your logbook</Link><Link href="/emergency" data-testid="footer-emergency">Response mode</Link></div></div>
    <div><p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-secondary">Whale Call office</p><p className="mt-4 text-sm leading-6 text-sidebar-foreground/70">VHF channel 16<br />Daily, first light to last launch<br />hello@whalecall.local</p></div>
  </div></footer>;
}

function Landing() {
  const { data: islands, isLoading, isError, refetch } = useListIslands({ query: { queryKey: getListIslandsQueryKey() } });
  const { data: summary } = useGetFleetSummary({ query: { queryKey: getGetFleetSummaryQueryKey() } });
  return <AppShell><main>
    <section className="relative overflow-hidden bg-sidebar px-5 pb-24 pt-16 text-sidebar-foreground lg:px-8 lg:pb-32 lg:pt-24">
      <div className="pointer-events-none absolute -right-28 -top-36 h-[550px] w-[550px] rounded-full border-[70px] border-secondary/10" /><div className="pointer-events-none absolute bottom-0 left-[38%] h-36 w-36 rounded-full bg-accent/20 blur-3xl" />
      <div className="relative mx-auto grid max-w-[1240px] items-end gap-14 lg:grid-cols-[1.02fr_.98fr]">
        <div className="rise-in"><p className="font-mono-ui text-[11px] uppercase tracking-[.22em] text-secondary">Whale Call · local passage, done right</p><h1 className="mt-7 max-w-2xl font-display text-6xl font-semibold leading-[.92] tracking-[-.055em]">Get there by<br /><span className="text-secondary">water.</span></h1><p className="mt-8 max-w-md text-base leading-7 text-sidebar-foreground/70">A ride across the bay, called by people who know every shoal, dock, and changing tide.</p><div className="mt-9 grid max-w-xl gap-3 sm:grid-cols-2"><Link href="/book" className="focus-ring inline-flex items-center justify-between gap-3 rounded-[22px] bg-secondary px-5 py-4 text-sm font-extrabold text-sidebar transition-transform hover:-translate-y-1" data-testid="link-hero-book"><span><span className="block text-[10px] uppercase tracking-[.16em] opacity-60">Voyage mode</span><span className="mt-1 block">Plan a crossing</span></span><ArrowRight size={18} /></Link><Link href="/emergency" className="focus-ring inline-flex items-center justify-between gap-3 rounded-[22px] border border-destructive/50 bg-destructive px-5 py-4 text-sm font-extrabold text-white transition-transform hover:-translate-y-1" data-testid="link-hero-emergency"><span><span className="block text-[10px] uppercase tracking-[.16em] text-white/70">Response mode</span><span className="mt-1 block">Need help now</span></span><LifeBuoy size={18} /></Link></div><Link href="/fleet" className="focus-ring mt-4 inline-flex items-center gap-2 text-sm font-bold text-sidebar-foreground/80 hover:text-sidebar-foreground" data-testid="link-hero-fleet">Meet the live fleet <ArrowRight size={15} /></Link></div>
        <div className="rise-in-delay relative mx-auto w-full max-w-[510px] lg:ml-auto"><div className="map-grid relative h-[340px] overflow-hidden rounded-[38px] border border-sidebar-foreground/10 shadow-2xl sm:h-[410px]">
          <div className="absolute left-[15%] top-[14%] h-36 w-48 rotate-12 rounded-[42%] bg-[#e8c58c]/80 shadow-lg island-shape" /><div className="absolute right-[9%] top-[42%] h-28 w-40 -rotate-12 rounded-[42%] bg-[#d9b77c]/75 shadow-lg island-shape" /><div className="absolute left-[32%] top-[34%] h-4 w-4 rounded-full bg-destructive ring-8 ring-destructive/15" /><div className="absolute right-[27%] top-[59%] h-4 w-4 rounded-full bg-primary ring-8 ring-primary/15" /><svg className="absolute inset-0 h-full w-full" viewBox="0 0 510 410" fill="none"><path d="M165 145C234 195 305 198 377 266" stroke="#0e5361" strokeDasharray="8 9" strokeWidth="3" /><path d="M165 145C234 195 305 198 377 266" stroke="#f4c95d" strokeDasharray="2 13" strokeLinecap="round" strokeWidth="7" /></svg>
          <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between rounded-2xl bg-sidebar/90 p-4 text-sidebar-foreground backdrop-blur-md"><div><p className="font-mono-ui text-[9px] uppercase tracking-[.18em] text-sidebar-foreground/55">Right now</p><p className="mt-1 text-sm font-bold">{summary?.available ?? '—'} boats ready to launch</p></div><div className="grid h-10 w-10 place-items-center rounded-full bg-accent text-sidebar"><Waves size={18} /></div></div>
        </div></div>
      </div>
    </section>
    <section className="mx-auto max-w-[1240px] px-5 py-20 lg:px-8"><div className="grid gap-12 lg:grid-cols-[.75fr_1.25fr]"><div><ModePill /><h2 className="mt-5 max-w-sm font-display text-4xl font-semibold leading-tight tracking-[-.04em] sm:text-5xl">Not an app.<br />A local hand.</h2><p className="mt-5 max-w-sm text-sm leading-6 text-muted-foreground">From the first call to the last wake, we keep you in the loop. No surge. No mystery dock.</p></div><div className="grid gap-4 sm:grid-cols-3"><ValueCard n="01" icon={Compass} title="Know the water" text="Every route is drawn by island hands, not an algorithm alone." /><ValueCard n="02" icon={BadgeCheck} title="See your captain" text="A name, a rating, and a boat you can recognize at the dock." /><ValueCard n="03" icon={HeartHandshake} title="Travel looked after" text="Clear pricing and a coastwatch team on channel if plans shift." /></div></div></section>
     <section className="bg-[#d8ebe8] px-5 py-20 lg:px-8"><div className="mx-auto max-w-[1240px]"><div className="flex flex-wrap items-end justify-between gap-6"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-primary">Where we launch</p><h2 className="mt-3 font-display text-4xl font-semibold tracking-[-.04em]">Seven fictional islands. One good idea.</h2></div><Link href="/book" className="group inline-flex items-center gap-2 text-sm font-bold text-primary" data-testid="link-island-book">Choose your dock <ArrowRight className="transition-transform group-hover:translate-x-1" size={16} /></Link></div>
      {isLoading ? <div className="mt-10 grid gap-4 sm:grid-cols-3"><LoadingCard /><LoadingCard /><LoadingCard /></div> : isError ? <div className="mt-10"><ErrorCard retry={refetch} /></div> : <div className="mt-10 grid gap-4 sm:grid-cols-3">{(islands ?? []).map((island, i) => <IslandCard key={island.id} island={island} index={i} />)}</div>}</div></section>
    <section className="px-5 py-20 lg:px-8"><div className="mx-auto grid max-w-[1240px] items-center gap-12 rounded-[34px] bg-primary px-7 py-10 text-primary-foreground sm:px-12 lg:grid-cols-[1fr_auto] lg:py-14"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-secondary">When the ordinary is not enough</p><h2 className="mt-4 max-w-xl font-display text-4xl font-semibold leading-tight tracking-[-.04em]">Response mode is always one tap away.</h2><p className="mt-4 max-w-lg text-sm leading-6 text-primary-foreground/70">For a medical need, a stranded boat, or water coming in. Our rescue-equipped boats and trained captains know what to do next.</p></div><Link href="/emergency" className="focus-ring inline-flex items-center gap-2 rounded-full bg-destructive px-6 py-3.5 text-sm font-extrabold text-white hover:-translate-y-1" data-testid="link-home-emergency">Open Response mode <LifeBuoy size={18} /></Link></div></section>
    <Footer />
  </main></AppShell>;
}

function HomeRoute() {
  return <Landing />;
}

function ValueCard({ n, icon: Icon, title, text }: { n: string; icon: typeof Compass; title: string; text: string }) {
  return <article className="rounded-[26px] border border-border bg-card p-6 transition-transform hover:-translate-y-1"><div className="flex items-center justify-between"><Icon className="text-accent" size={24} /><span className="font-mono-ui text-[10px] text-muted-foreground">{n}</span></div><h3 className="mt-12 font-display text-2xl font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p></article>;
}

function IslandCard({ island, index }: { island: Island; index: number }) {
  return <Link href="/book" className="group focus-ring relative min-h-[180px] overflow-hidden rounded-[26px] border border-primary/10 bg-card p-6 shadow-sm transition-transform hover:-translate-y-1" data-testid={`card-island-${island.id}`}><div className={`absolute -right-9 -top-9 h-36 w-36 rounded-full ${index === 1 ? 'bg-secondary/60' : 'bg-accent/15'} transition-transform group-hover:scale-125`} /><div className="relative"><p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-primary">Island 0{index + 1}</p><h3 className="mt-4 font-display text-3xl font-semibold">{island.name}</h3><p className="mt-2 max-w-[210px] text-sm text-muted-foreground">{island.tagline}</p><p className="mt-5 text-xs font-bold text-primary">{island.docks?.length ?? 0} public docks <ArrowRight className="ml-1 inline" size={13} /></p></div></Link>;
}

const mapPositions: Record<string, { x: number; y: number; width: number; height: number; rotate: number }> = {
  'coral-cove': { x: 17, y: 19, width: 20, height: 14, rotate: -8 },
  'pelican-key': { x: 48, y: 11, width: 22, height: 13, rotate: 9 },
  'mango-harbor': { x: 76, y: 25, width: 18, height: 13, rotate: -6 },
  'starfish-bay': { x: 10, y: 53, width: 22, height: 14, rotate: 8 },
  'lighthouse-isle': { x: 42, y: 50, width: 20, height: 13, rotate: -5 },
  'turtle-point': { x: 72, y: 57, width: 20, height: 13, rotate: 7 },
  'driftwood-island': { x: 30, y: 69, width: 24, height: 13, rotate: -10 },
};

function IslandMap({ islands, pickupId, destinationId, emergency = false }: { islands: Island[]; pickupId?: string; destinationId?: string; emergency?: boolean }) {
  const pickup = pickupId ? mapPositions[pickupId] : undefined;
  const destination = destinationId ? mapPositions[destinationId] : undefined;
  const route = pickup && destination ? `M ${pickup.x + pickup.width / 2} ${pickup.y + pickup.height / 2} C 43 41, 58 50, ${destination.x + destination.width / 2} ${destination.y + destination.height / 2}` : '';
  return <div className={`map-grid relative min-h-[310px] overflow-hidden rounded-[30px] border ${emergency ? 'border-destructive/20' : 'border-primary/10'}`} aria-label="Map of the fictional Whale Call islands" data-testid="island-map">
    <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,.22) 0 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {route && <path d={route} fill="none" stroke={emergency ? '#c94c42' : '#f4c95d'} strokeDasharray="2 3" strokeLinecap="round" strokeWidth="1.2" />}
    </svg>
    {islands.map((island, index) => {
      const position = mapPositions[island.id] ?? { x: 10 + (index % 4) * 22, y: 15 + Math.floor(index / 4) * 35, width: 18, height: 13, rotate: 0 };
      const selected = island.id === pickupId || island.id === destinationId;
      const role = island.id === pickupId ? 'Leaving' : island.id === destinationId ? 'Arriving' : '';
      return <div key={island.id} className="absolute" style={{ left: `${position.x}%`, top: `${position.y}%`, width: `${position.width}%`, height: `${position.height}%`, transform: `rotate(${position.rotate}deg)` }}>
        <div className={`island-shape flex h-full w-full items-center justify-center rounded-[45%] border text-center shadow-md ${selected ? 'border-secondary bg-[#e8c58c]' : 'border-[#d9b77c]/60 bg-[#e5c283]/85'}`}>
          <span className="px-1 text-[7px] font-extrabold uppercase leading-tight tracking-[.08em] text-[#173943] sm:text-[8px]">{island.name}</span>
        </div>
        {selected && <span className={`absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-1 font-mono-ui text-[7px] uppercase tracking-[.12em] ${emergency ? 'bg-destructive text-white' : 'bg-primary text-primary-foreground'}`}>{role}</span>}
      </div>;
    })}
    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-2xl bg-card/90 px-4 py-3 backdrop-blur">
      <div><p className="font-mono-ui text-[9px] uppercase tracking-[.16em] text-primary">Whale Call chart</p><p className="mt-1 text-xs font-semibold text-muted-foreground">{pickup && destination ? 'Route plotted across the island chain' : 'Seven fictional islands · local docks only'}</p></div>
      <span className={`h-2.5 w-2.5 rounded-full ${emergency ? 'bg-destructive' : 'bg-accent'}`} />
    </div>
  </div>;
}

function FleetPage() {
  const [classFilter, setClassFilter] = useState<string>('');
  const [rescueOnly, setRescueOnly] = useState(false);
  const params = useMemo(() => ({ ...(classFilter ? { boatClass: classFilter as BoatClass } : {}), ...(rescueOnly ? { emergencyEquipped: true } : {}) }), [classFilter, rescueOnly]);
  const { data: fleet, isLoading, isError, refetch } = useListFleet(params, { query: { queryKey: getListFleetQueryKey(params) } });
  const { data: summary } = useGetFleetSummary({ query: { queryKey: getGetFleetSummaryQueryKey() } });
  return <AppShell><main className="mx-auto max-w-[1240px] px-5 py-12 lg:px-8 lg:py-16"><div className="flex flex-wrap items-end justify-between gap-6"><div><ModePill /><h1 className="mt-5 font-display text-5xl font-semibold tracking-[-.05em] sm:text-6xl">The live fleet.</h1><p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">Every boat here is canonical. If you can see it, it is on the water with us today.</p></div><div className="flex gap-6 rounded-2xl border border-border bg-card px-5 py-4"><Stat label="Total boats" value={summary?.total} /><Stat label="Ready now" value={summary?.available} /><Stat label="Rescue ready" value={summary?.rescueReady} /></div></div>
    <div className="mt-12 flex flex-wrap items-center gap-3 border-y border-border py-4"><select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="focus-ring rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold" data-testid="select-boat-class"><option value="">All boat classes</option><option value={BoatClass.water_taxi}>Water taxi</option><option value={BoatClass.cruiser}>Cruiser</option><option value={BoatClass.catamaran}>Catamaran</option><option value={BoatClass.speedboat}>Speedboat</option></select><button type="button" onClick={() => setRescueOnly(!rescueOnly)} className={`focus-ring inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold ${rescueOnly ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card'}`} data-testid="button-filter-rescue"><ShieldCheck size={16} />Rescue-equipped</button><span className="ml-auto font-mono-ui text-[10px] uppercase tracking-[.15em] text-muted-foreground">{fleet?.length ?? 0} vessels in view</span></div>
    {isLoading ? <div className="mt-8 grid gap-5 md:grid-cols-2"><LoadingCard /><LoadingCard /></div> : isError ? <div className="mt-8"><ErrorCard retry={refetch} /></div> : fleet?.length ? <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{fleet.map(boat => <BoatCard key={boat.id} boat={boat} />)}</div> : <div className="mt-8"><EmptyCard title="No boats in that channel." text="Try a wider filter and check back with the dockmaster." /></div>}</main><Footer /></AppShell>;
}

function Stat({ label, value }: { label: string; value?: number }) { return <div><p className="font-mono-ui text-[9px] uppercase tracking-[.14em] text-muted-foreground">{label}</p><p className="mt-1 font-display text-2xl font-semibold">{value ?? '—'}</p></div>; }
function BoatCard({ boat }: { boat: FleetBoat }) {
  const [expanded, setExpanded] = useState(false);
  const { data: detail, isLoading } = useGetFleetBoat(boat.id, { query: { enabled: expanded, queryKey: getGetFleetBoatQueryKey(boat.id) } });
  return <article className="group overflow-hidden rounded-[28px] border border-border bg-card shadow-sm transition-transform hover:-translate-y-1" data-testid={`card-boat-${boat.id}`}><div className="map-grid relative h-40"><div className="absolute left-[20%] top-[35%] h-16 w-24 rotate-[-9deg] rounded-[48%_52%_42%_55%] bg-[#e8c58c] shadow-md"><div className="absolute -right-6 top-7 h-1 w-10 bg-primary/70" /></div><div className="absolute right-5 top-5 flex items-center gap-2 rounded-full bg-card/85 px-3 py-1.5 font-mono-ui text-[9px] uppercase tracking-[.14em] backdrop-blur"><span className={`h-1.5 w-1.5 rounded-full ${boat.status === BoatStatus.available ? 'bg-accent' : 'bg-secondary'}`} />{boat.status.replace('_', ' ')}</div></div><div className="p-5"><div className="flex items-start justify-between"><div><h3 className="font-display text-2xl font-semibold">{boat.name}</h3><p className="mt-1 text-xs capitalize text-muted-foreground">{boat.boatClass.replace('_', ' ')} · up to {boat.capacity} passengers</p></div>{boat.emergencyEquipped && <ShieldCheck className="text-accent" size={20} />}</div><div className="mt-5 flex items-center gap-3 border-t border-border pt-4"><span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{boat.assignedDriver?.name?.split(' ').map(n => n[0]).join('')}</span><div><p className="text-sm font-bold">{boat.assignedDriver?.name}</p><p className="text-xs text-muted-foreground"><Star className="mr-1 inline fill-secondary text-secondary" size={11} />{boat.assignedDriver?.rating?.toFixed(1)} · {boat.assignedDriver?.yearsActive} years on the water</p></div></div><button type="button" onClick={() => setExpanded(!expanded)} className="mt-4 text-xs font-bold text-primary" data-testid={`button-boat-details-${boat.id}`}>{expanded ? 'Hide boat details' : 'View boat details'} <ChevronDown className={`ml-1 inline transition-transform ${expanded ? 'rotate-180' : ''}`} size={14} /></button>{expanded && <div className="mt-3 rounded-xl bg-muted p-3 text-xs leading-5 text-muted-foreground" data-testid={`details-boat-${boat.id}`}>{isLoading ? 'Opening the boat log…' : `${detail?.assignedDriver?.languages?.join(', ') ?? 'Local crew'} · heading ${Math.round(detail?.heading ?? boat.heading)}° · ${detail?.assignedDriver?.tripsCompleted ?? boat.assignedDriver?.tripsCompleted ?? 0} trips completed`}</div>}</div></article>;
}

function EmptyCard({ title, text }: { title: string; text: string }) { return <div className="rounded-[28px] border border-dashed border-border bg-card p-12 text-center"><Binoculars className="mx-auto text-accent" size={30} /><h3 className="mt-4 font-display text-2xl">{title}</h3><p className="mt-2 text-sm text-muted-foreground">{text}</p></div>; }

function BookingPage() {
  const { data: islands, isLoading, isError, refetch } = useListIslands({ query: { queryKey: getListIslandsQueryKey() } });
  const createTrip = useCreateTrip();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<TripInput>({ pickupIslandId: '', pickupDockId: '', destinationIslandId: '', destinationDockId: '', boatClass: BoatClass.water_taxi, passengerCount: 1 });
  const pickup = islands?.find(i => i.id === form.pickupIslandId);
  const destination = islands?.find(i => i.id === form.destinationIslandId);
  const validRoute = form.pickupIslandId && form.destinationIslandId && form.pickupIslandId !== form.destinationIslandId && form.pickupDockId && form.destinationDockId;
  const submit = (e: FormEvent) => { e.preventDefault(); if (step < 3) { setStep(step + 1); return; } createTrip.mutate({ data: form }, { onSuccess: trip => { queryClient.invalidateQueries({ queryKey: getGetTripQueryKey(trip.id) }); setLocation(`/trip/${trip.id}`); } }); };
  if (isLoading) return <AppShell><main className="mx-auto max-w-[900px] px-5 py-16"><LoadingCard /></main></AppShell>;
  if (isError) return <AppShell><main className="mx-auto max-w-[900px] px-5 py-16"><ErrorCard retry={refetch} /></main></AppShell>;
  return <AppShell><main className="mx-auto max-w-[1000px] px-5 py-12 lg:px-8 lg:py-16"><div className="grid gap-10 lg:grid-cols-[.75fr_1.25fr]"><div><ModePill /><p className="mt-8 font-mono-ui text-[10px] uppercase tracking-[.2em] text-primary">New crossing</p><h1 className="mt-4 font-display text-5xl font-semibold leading-[.95] tracking-[-.05em]">Where shall<br />we take you?</h1><p className="mt-5 text-sm leading-6 text-muted-foreground">Tell us the simple bits. A real captain will handle the rest.</p><div className="mt-8"><IslandMap islands={islands ?? []} pickupId={form.pickupIslandId} destinationId={form.destinationIslandId} /></div><div className="mt-8 flex gap-2">{[1,2,3].map(n => <div key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? 'bg-secondary' : 'bg-muted'}`} />)}</div><p className="mt-3 font-mono-ui text-[10px] uppercase tracking-[.15em] text-muted-foreground">Step {step} of 3</p></div>
      <form onSubmit={submit} className="rounded-[32px] border border-border bg-card p-6 shadow-lg sm:p-9" data-testid="form-booking">
        {step === 1 && <><h2 className="font-display text-3xl font-semibold">Pick your waterline</h2><p className="mt-2 text-sm text-muted-foreground">Choose the island and dock you are leaving from.</p><div className="mt-8 grid gap-5"><IslandSelect label="Leaving from" value={form.pickupIslandId} islands={islands ?? []} onChange={id => setForm({ ...form, pickupIslandId: id, pickupDockId: '' })} testId="select-pickup-island" /><DockSelect label="Departure dock" value={form.pickupDockId} docks={pickup?.docks ?? []} onChange={id => setForm({ ...form, pickupDockId: id })} testId="select-pickup-dock" /></div></>}
        {step === 2 && <><h2 className="font-display text-3xl font-semibold">Choose your landing</h2><p className="mt-2 text-sm text-muted-foreground">We will put you down at the dock that makes sense.</p><div className="mt-8 grid gap-5"><IslandSelect label="Going to" value={form.destinationIslandId} islands={islands ?? []} onChange={id => setForm({ ...form, destinationIslandId: id, destinationDockId: '' })} testId="select-destination-island" /><DockSelect label="Arrival dock" value={form.destinationDockId} docks={destination?.docks ?? []} onChange={id => setForm({ ...form, destinationDockId: id })} testId="select-destination-dock" /></div></>}
        {step === 3 && <><h2 className="font-display text-3xl font-semibold">Make it yours</h2><p className="mt-2 text-sm text-muted-foreground">One last look before we call a captain.</p><div className="mt-7 divide-y divide-border rounded-2xl border border-border"><SummaryLine label="Route" value={`${pickup?.name ?? '—'} → ${destination?.name ?? '—'}`} /><SummaryLine label="Docks" value={`${pickup?.docks.find(d => d.id === form.pickupDockId)?.name ?? '—'} → ${destination?.docks.find(d => d.id === form.destinationDockId)?.name ?? '—'}`} /><label className="flex items-center justify-between gap-4 p-4"><span className="text-sm font-semibold">Passengers</span><input type="number" min={1} max={16} value={form.passengerCount} onChange={e => setForm({ ...form, passengerCount: Number(e.target.value) })} className="focus-ring w-20 rounded-xl border border-border bg-background px-3 py-2 text-center font-bold" data-testid="input-passengers" /></label><label className="flex items-center justify-between gap-4 p-4"><span className="text-sm font-semibold">Boat class</span><select value={form.boatClass} onChange={e => setForm({ ...form, boatClass: e.target.value as TripInput['boatClass'] })} className="focus-ring rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold" data-testid="select-boat-class-booking"><option value={BoatClass.water_taxi}>Water taxi</option><option value={BoatClass.cruiser}>Cruiser</option><option value={BoatClass.catamaran}>Catamaran</option><option value={BoatClass.speedboat}>Speedboat</option></select></label></div>{createTrip.isError && <p className="mt-4 text-sm font-semibold text-destructive" data-testid="status-booking-error">We could not reach the dock. Please try again.</p>}</>}
        <div className="mt-9 flex items-center justify-between gap-3">{step > 1 ? <Button kind="quiet" type="button" onClick={() => setStep(step - 1)} data-testid="button-booking-back">Back</Button> : <Link href="/emergency" className="text-xs font-bold text-destructive" data-testid="link-booking-emergency">Need Response mode?</Link>}<Button type="submit" disabled={(step === 1 && !form.pickupDockId) || (step === 2 && !validRoute) || createTrip.isPending} data-testid="button-booking-next">{createTrip.isPending ? 'Calling a captain…' : step === 3 ? 'Call my boat' : 'Continue'} <ArrowRight size={16} /></Button></div>
      </form></div></main></AppShell>;
}

function IslandSelect({ label, value, islands, onChange, testId }: { label: string; value: string; islands: Island[]; onChange: (s: string) => void; testId: string }) { return <label className="grid gap-2 text-sm font-bold">{label}<select required value={value} onChange={e => onChange(e.target.value)} className="focus-ring rounded-2xl border border-border bg-background px-4 py-3.5 font-semibold" data-testid={testId}><option value="">Select an island</option>{islands.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>; }
function DockSelect({ label, value, docks, onChange, testId }: { label: string; value: string; docks: Dock[]; onChange: (s: string) => void; testId: string }) { return <label className="grid gap-2 text-sm font-bold">{label}<select required value={value} onChange={e => onChange(e.target.value)} className="focus-ring rounded-2xl border border-border bg-background px-4 py-3.5 font-semibold disabled:opacity-50" disabled={!docks.length} data-testid={testId}><option value="">{docks.length ? 'Select a dock' : 'Choose an island first'}</option>{docks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>; }
function SummaryLine({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4 p-4"><span className="text-xs text-muted-foreground">{label}</span><span className="text-right text-sm font-bold">{value}</span></div>; }

function TripPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { data: trip, isLoading, isError, refetch } = useGetTrip(id, { query: { enabled: !!id, queryKey: getGetTripQueryKey(id) } });
  const completeTrip = useCompleteTrip();
  if (isLoading) return <AppShell><main className="mx-auto max-w-[1000px] px-5 py-16"><LoadingCard label="Finding your crossing" /></main></AppShell>;
  if (isError || !trip) return <AppShell><main className="mx-auto max-w-[1000px] px-5 py-16"><ErrorCard retry={refetch} message="We could not find that crossing." /></main></AppShell>;
  const done = trip.status === 'completed';
  return <AppShell><main className="mx-auto max-w-[1000px] px-5 py-12 lg:px-8 lg:py-16"><div className="flex flex-wrap items-start justify-between gap-6"><div><ModePill /><p className="mt-8 font-mono-ui text-[10px] uppercase tracking-[.2em] text-primary">Crossing {trip.id.slice(0, 8)}</p><h1 className="mt-3 font-display text-5xl font-semibold tracking-[-.05em]">{done ? 'Safe on shore.' : 'Your boat is on the way.'}</h1><p className="mt-4 text-sm text-muted-foreground">{done ? 'Thanks for travelling with us.' : `${trip.etaMinutes} minutes until we reach you.`}</p></div><div className={`rounded-2xl px-4 py-3 font-mono-ui text-[10px] uppercase tracking-[.16em] ${done ? 'bg-accent/15 text-primary' : 'bg-secondary/25 text-primary'}`} data-testid="status-trip">{trip.status.replace('_', ' ')}</div></div>
    <div className="mt-10 grid gap-5 lg:grid-cols-[1.25fr_.75fr]"><div className="map-grid relative min-h-[370px] overflow-hidden rounded-[30px] border border-border"><div className="absolute left-[18%] top-[17%] h-32 w-44 rotate-6 rounded-[42%] bg-[#e5c283] island-shape" /><div className="absolute bottom-[17%] right-[12%] h-28 w-40 -rotate-12 rounded-[42%] bg-[#d5ae6d] island-shape" /><div className="absolute left-[28%] top-[35%] h-3 w-3 rounded-full bg-primary ring-8 ring-primary/15" /><div className="absolute bottom-[29%] right-[30%] h-3 w-3 rounded-full bg-destructive ring-8 ring-destructive/15" /><div className="absolute left-[32%] top-[40%] h-16 w-28 rotate-12 rounded-[50%] border-4 border-secondary bg-primary shadow-xl"><span className="absolute -right-5 top-5 h-1 w-7 bg-primary" /></div><div className="absolute bottom-5 left-5 right-5 rounded-2xl bg-card/90 p-4 backdrop-blur"><div className="flex items-center justify-between"><p className="text-sm font-bold">{trip.boat?.name ?? 'Your boat'}</p><p className="font-mono-ui text-xs text-primary">{trip.distanceKm} km crossing</p></div><p className="mt-1 text-xs text-muted-foreground">Captain {trip.boat?.assignedDriver?.name ?? 'on duty'} · {trip.boat?.assignedDriver?.rating?.toFixed(1)} rating</p></div></div>
      <div className="rounded-[30px] border border-border bg-card p-6"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-primary">Passage details</p><div className="mt-6 grid gap-5"><SummaryLine label="From" value={trip.pickupIslandId} /><SummaryLine label="To" value={trip.destinationIslandId} /><SummaryLine label="Passengers" value={String(trip.passengerCount)} /><SummaryLine label="Fare" value={`$${trip.price.toFixed(2)}`} /></div>{!done && <Button className="mt-6 w-full" onClick={() => completeTrip.mutate({ tripId: trip.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetTripQueryKey(trip.id) }) })} disabled={completeTrip.isPending} data-testid="button-complete-trip">{completeTrip.isPending ? 'Closing the log…' : 'Mark crossing complete'} <Check size={16} /></Button>}{done && <div className="mt-6 flex items-center gap-2 rounded-2xl bg-accent/10 p-4 text-sm font-bold text-primary" data-testid="status-trip-complete"><CircleCheck size={19} /> Passage logged</div>}</div></div></main></AppShell>;
}

function EmergencyPage() {
  const createEmergency = useCreateEmergency();
  const [, setLocation] = useLocation();
  const [confirmed, setConfirmed] = useState(false);
  const [situation, setSituation] = useState<EmergencySituation>(EmergencySituation.stranded);
  const [notes, setNotes] = useState('');
  const [locating, setLocating] = useState(false);
  const [position, setPosition] = useState({ lat: 18.42, lng: -64.61 });
  const locate = () => { setLocating(true); navigator.geolocation?.getCurrentPosition(p => { setPosition({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocating(false); }, () => setLocating(false)); };
  const dispatch = () => createEmergency.mutate({ data: { situation, position, notes, tripId: null } }, { onSuccess: incident => { queryClient.invalidateQueries({ queryKey: getGetEmergencyQueryKey(incident.id) }); setLocation(`/emergency/${incident.id}`); } });
  return <AppShell emergency><main className="mx-auto max-w-[1000px] px-5 py-12 lg:px-8 lg:py-16"><div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]"><div><ModePill emergency /><p className="mt-8 font-mono-ui text-[10px] uppercase tracking-[.2em] text-destructive">Coastwatch dispatch</p><h1 className="mt-4 font-display text-5xl font-semibold leading-[.93] tracking-[-.05em] sm:text-6xl">Keep calm.<br />We know this water.</h1><p className="mt-5 max-w-sm text-sm leading-6 text-muted-foreground">Response mode is for immediate help on or near the water. Tell us what is happening, then stay where you are if it is safe.</p><div className="mt-10 flex items-start gap-3 text-sm text-foreground/70"><ShieldCheck className="mt-0.5 shrink-0 text-primary" size={18} /><span>Our dispatch team receives your location and sends the nearest rescue-equipped boat.</span></div></div>
       <div className="rounded-[30px] border border-destructive/20 bg-card p-6 shadow-lg sm:p-9">{!confirmed ? <><div className="flex items-center justify-between"><h2 className="font-display text-3xl font-semibold">What is happening?</h2><Radio className="text-destructive" size={23} /></div><p className="mt-2 text-sm text-muted-foreground">Pick the closest description.</p><div className="mt-7 grid gap-3 sm:grid-cols-2">{([{ value: EmergencySituation.stranded, label: 'Stranded or adrift', icon: Anchor }, { value: EmergencySituation.medical, label: 'Medical need', icon: HeartHandshake }, { value: EmergencySituation.taking_on_water, label: 'Taking on water', icon: Waves }, { value: EmergencySituation.other, label: 'Something else', icon: CircleAlert }] as const).map(item => { const Icon = item.icon; return <button type="button" key={item.value} onClick={() => setSituation(item.value)} className={`focus-ring flex items-center gap-3 rounded-2xl border p-4 text-left text-sm font-bold transition-colors ${situation === item.value ? 'border-destructive bg-destructive/10 text-destructive' : 'border-border hover:bg-muted'}`} data-testid={`button-situation-${item.value}`}><Icon size={19} />{item.label}{situation === item.value && <Check className="ml-auto" size={16} />}</button>; })}</div><label className="mt-7 grid gap-2 text-sm font-bold">Notes for the captain <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="What should the crew know?" className="focus-ring resize-none rounded-2xl border border-border bg-background px-4 py-3 font-normal" data-testid="input-emergency-notes" /></label><div className="mt-5 flex items-center justify-between rounded-2xl bg-muted p-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground"><Crosshair size={17} /></span><div><p className="text-xs font-bold">Your location</p><p className="font-mono-ui text-[10px] text-muted-foreground">{position.lat.toFixed(4)}, {position.lng.toFixed(4)}</p></div></div><button type="button" onClick={locate} className="text-xs font-bold text-primary underline-offset-4 hover:underline" data-testid="button-use-location">{locating ? 'Locating…' : 'Use my location'}</button></div><div className="mt-8 flex items-center justify-between gap-4"><Link href="/" className="text-xs font-bold text-muted-foreground" data-testid="link-cancel-emergency">Cancel</Link><Button type="button" kind="danger" onClick={() => setConfirmed(true)} data-testid="button-review-emergency">Review dispatch <ArrowRight size={16} /></Button></div></> : <><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-destructive text-white"><LifeBuoy size={30} /></div><h2 className="mt-6 text-center font-display text-3xl font-semibold">Ready to send for help?</h2><p className="mx-auto mt-3 max-w-sm text-center text-sm leading-6 text-muted-foreground">We will send the nearest rescue-equipped boat to your location. Keep your phone visible and stay on channel.</p><div className="mt-7 divide-y divide-border rounded-2xl border border-border"><SummaryLine label="Situation" value={situation.replaceAll('_', ' ')} /><SummaryLine label="Coordinates" value={`${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}`} /><SummaryLine label="Notes" value={notes || 'No additional notes'} /></div>{createEmergency.isError && <p className="mt-4 text-sm font-bold text-destructive" data-testid="status-emergency-error">Dispatch could not be reached. Try again.</p>}<div className="mt-8 flex gap-3"><Button type="button" kind="quiet" className="flex-1" onClick={() => setConfirmed(false)} data-testid="button-edit-emergency">Edit</Button><Button type="button" kind="danger" className="flex-1" onClick={dispatch} disabled={createEmergency.isPending} data-testid="button-send-emergency">{createEmergency.isPending ? 'Calling rescue…' : 'Send for help'} <Radio size={16} /></Button></div></>}</div></div></main></AppShell>;
}

function EmergencyTrackingPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { data: incident, isLoading, isError, refetch } = useGetEmergency(id, { query: { enabled: !!id, queryKey: getGetEmergencyQueryKey(id) } });
  const resolve = useResolveEmergency();
  if (isLoading) return <AppShell emergency><main className="mx-auto max-w-[1000px] px-5 py-16"><LoadingCard label="Connecting to coastwatch" /></main></AppShell>;
  if (isError || !incident) return <AppShell emergency><main className="mx-auto max-w-[1000px] px-5 py-16"><ErrorCard retry={refetch} message="We could not locate that response call." /></main></AppShell>;
  const resolved = incident.status === 'resolved';
  return <AppShell emergency><main className="mx-auto max-w-[1000px] px-5 py-12 lg:px-8 lg:py-16"><div className="flex flex-wrap items-end justify-between gap-5"><div><ModePill emergency /><p className="mt-7 font-mono-ui text-[10px] uppercase tracking-[.2em] text-destructive">Response call {incident.id.slice(0, 8)}</p><h1 className="mt-3 font-display text-5xl font-semibold tracking-[-.05em]">{resolved ? 'Response complete.' : 'Help is moving.'}</h1><p className="mt-4 text-sm text-muted-foreground">{resolved ? 'The incident has been safely resolved.' : `Rescue boat ETA: ${incident.etaMinutes} minutes.`}</p></div><div className="flex items-center gap-2 rounded-full bg-card px-4 py-2 font-mono-ui text-[10px] uppercase tracking-[.16em] text-destructive" data-testid="status-emergency"><span className="pulse-ring absolute h-5 w-5 rounded-full bg-destructive/30" /><span className="relative h-2 w-2 rounded-full bg-destructive" />{incident.status.replace('_', ' ')}</div></div><div className="mt-10 grid gap-5 lg:grid-cols-[1.25fr_.75fr]"><div className="map-grid relative min-h-[390px] overflow-hidden rounded-[30px] border border-destructive/15"><div className="absolute left-[18%] top-[16%] h-36 w-48 rounded-[42%] bg-[#e5c283] island-shape" /><div className="absolute bottom-[17%] right-[13%] h-32 w-44 rotate-12 rounded-[42%] bg-[#d4ae6f] island-shape" /><div className="absolute left-[40%] top-[43%] grid h-12 w-12 place-items-center rounded-full bg-destructive text-white shadow-xl"><LifeBuoy size={24} /></div><div className="absolute right-[31%] bottom-[30%] grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground shadow-xl"><Sailboat size={21} /></div><div className="absolute left-[45%] top-[48%] h-24 w-[25%] border-t-2 border-dashed border-destructive/70 rotate-[15deg]" /><div className="absolute bottom-5 left-5 right-5 flex items-center justify-between rounded-2xl bg-card/90 p-4 backdrop-blur"><div><p className="text-sm font-bold">{incident.rescueBoat?.name}</p><p className="mt-1 text-xs text-muted-foreground">Captain {incident.rescueBoat?.assignedDriver?.name} · rescue equipped</p></div><a href="tel:+18005550116" className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground" data-testid="link-call-coastwatch" aria-label="Call coastwatch"><Phone size={17} /></a></div></div><div className="rounded-[30px] border border-border bg-card p-6"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-destructive">Dispatch details</p><div className="mt-6 grid gap-5"><SummaryLine label="Situation" value={incident.situation.replaceAll('_', ' ')} /><SummaryLine label="Distance" value={`${incident.distanceKm} km away`} /><SummaryLine label="Notes" value={incident.notes || 'No additional notes'} /></div>{!resolved ? <Button kind="danger" className="mt-6 w-full" onClick={() => resolve.mutate({ emergencyId: incident.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetEmergencyQueryKey(incident.id) }) })} disabled={resolve.isPending} data-testid="button-resolve-emergency">{resolve.isPending ? 'Updating coastwatch…' : 'Mark response resolved'} <Check size={16} /></Button> : <div className="mt-6 flex items-center gap-2 rounded-2xl bg-accent/10 p-4 text-sm font-bold text-primary" data-testid="status-emergency-resolved"><CircleCheck size={19} /> Coastwatch has closed this call</div>}</div></div></main></AppShell>;
}

function ProfilePage() {
  const { user, loaded: isLoaded, signedIn } = useAuthUi();
  if (!isLoaded) return <AppShell><main className="mx-auto max-w-[900px] px-5 py-16"><LoadingCard label="Opening your logbook" /></main></AppShell>;
  if (!signedIn) return <AppShell><main className="mx-auto max-w-[760px] px-5 py-16 lg:px-8"><div className="rounded-[32px] border border-border bg-card p-8 text-center shadow-sm sm:p-12"><div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-secondary text-primary"><BookOpen size={25} /></div><h1 className="mt-6 font-display text-4xl font-semibold tracking-[-.04em]">Your logbook is waiting.</h1><p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-muted-foreground">Sign in to keep your crossings, captains, and favourite docks in one place.</p><div className="mt-8 flex justify-center gap-3"><Link href="/sign-in" className="rounded-full border border-border px-5 py-3 text-sm font-bold" data-testid="link-profile-sign-in">Sign in</Link><Link href="/sign-up" className="rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground" data-testid="link-profile-sign-up">Create account</Link></div></div></main></AppShell>;
  return <AppShell><main className="mx-auto max-w-[1000px] px-5 py-12 lg:px-8 lg:py-16"><div className="flex flex-wrap items-end justify-between gap-5"><div><ModePill /><p className="mt-8 font-mono-ui text-[10px] uppercase tracking-[.2em] text-primary">Your logbook</p><h1 className="mt-3 font-display text-5xl font-semibold tracking-[-.05em]">{user?.firstName ? `Hello, ${user.firstName}.` : 'Your crossings.'}</h1><p className="mt-4 text-sm text-muted-foreground">The useful bits, kept close.</p></div><Link href="/book" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground" data-testid="link-profile-book">Plan a crossing <ArrowRight size={16} /></Link></div><div className="mt-10 grid gap-5 md:grid-cols-[.8fr_1.2fr]"><div className="rounded-[28px] bg-sidebar p-6 text-sidebar-foreground"><div className="flex items-center gap-4"><span className="grid h-16 w-16 place-items-center rounded-full bg-secondary text-xl font-extrabold text-sidebar">{user?.firstName?.[0] ?? 'C'}</span><div><h2 className="font-display text-2xl">{user?.fullName ?? 'Island traveller'}</h2><p className="mt-1 text-sm text-sidebar-foreground/60">{user?.primaryEmailAddress?.emailAddress ?? 'Your email on file'}</p></div></div><div className="mt-10 grid grid-cols-2 gap-4 border-t border-sidebar-border pt-5"><div><p className="font-mono-ui text-[9px] uppercase tracking-[.15em] text-sidebar-foreground/50">Crossings</p><p className="mt-1 font-display text-3xl">0</p></div><div><p className="font-mono-ui text-[9px] uppercase tracking-[.15em] text-sidebar-foreground/50">Home dock</p><p className="mt-1 font-display text-xl">—</p></div></div></div><div className="rounded-[28px] border border-border bg-card p-7"><div className="flex items-center justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-primary">Recent activity</p><h2 className="mt-2 font-display text-2xl">Nothing logged yet.</h2></div><BookOpen className="text-accent" size={26} /></div><p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">Your completed crossings will appear here with the captain, route, and fare.</p><Link href="/book" className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-primary" data-testid="link-profile-empty-book">Make your first crossing <ArrowRight size={16} /></Link></div></div></main></AppShell>;
}

function AuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-sidebar px-4 py-10"><div className="absolute left-6 top-6"><Logo dark /></div><div className="w-full max-w-[440px] rounded-[28px] bg-card p-2 shadow-2xl">{clerkPubKey ? (mode === 'sign-in' ? <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /> : <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />) : <FallbackAuthPage mode={mode} />}</div></div>;
}

function FallbackAuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  return <div className="p-6 sm:p-8"><p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-primary">Whale Call account</p><h1 className="mt-4 font-display text-3xl font-semibold">{mode === 'sign-in' ? 'Welcome aboard.' : 'Join the crew.'}</h1><p className="mt-2 text-sm text-muted-foreground">{mode === 'sign-in' ? 'Sign in to keep your crossings close.' : 'Save your favourite docks and crossings.'}</p><form onSubmit={e => { e.preventDefault(); setLocation('/book'); }} className="mt-7 grid gap-4"><label className="grid gap-2 text-sm font-bold">Email<input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="focus-ring rounded-2xl border border-border bg-background px-4 py-3 font-normal" data-testid="input-auth-email" /></label><label className="grid gap-2 text-sm font-bold">Password<input type="password" required className="focus-ring rounded-2xl border border-border bg-background px-4 py-3 font-normal" data-testid="input-auth-password" /></label><Button type="submit" className="mt-2" data-testid="button-auth-submit">{mode === 'sign-in' ? 'Sign in' : 'Create account'} <ArrowRight size={16} /></Button></form><button type="button" onClick={() => setLocation(mode === 'sign-in' ? '/sign-up' : '/sign-in')} className="mt-6 w-full text-center text-xs font-bold text-primary" data-testid="button-auth-switch">{mode === 'sign-in' ? 'Need an account? Create one' : 'Already have an account? Sign in'}</button></div>;
}

function Router() {
  return <Switch><Route path="/" component={HomeRoute} /><Route path="/book" component={BookingPage} /><Route path="/fleet" component={FleetPage} /><Route path="/trip/:id" component={TripPage} /><Route path="/emergency" component={EmergencyPage} /><Route path="/emergency/:id" component={EmergencyTrackingPage} /><Route path="/profile" component={ProfilePage} /><Route path="/sign-in/*?" component={() => <AuthPage mode="sign-in" />} /><Route path="/sign-up/*?" component={() => <AuthPage mode="sign-up" />} /><Route component={NotFound} /></Switch>;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: { logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${logoSrc}` },
  variables: { colorPrimary: '#0e5361', colorForeground: '#173943', colorMutedForeground: '#587078', colorDanger: '#c94c42', colorBackground: '#f9fcfb', colorInput: '#edf5f3', colorInputForeground: '#173943', colorNeutral: '#c8d8d5', fontFamily: 'Manrope', borderRadius: '1rem' },
  elements: { rootBox: 'w-full flex justify-center', cardBox: 'bg-[#f9fcfb] rounded-2xl w-[440px] max-w-full overflow-hidden', card: '!shadow-none !border-0 !bg-transparent !rounded-none', footer: '!shadow-none !border-0 !bg-transparent !rounded-none', headerTitle: 'text-[#173943] font-semibold', headerSubtitle: 'text-[#587078]', formFieldLabel: 'text-[#173943]', footerActionLink: 'text-[#0e5361]', footerActionText: 'text-[#587078]', dividerText: 'text-[#587078]', formButtonPrimary: 'bg-[#0e5361] hover:bg-[#174f5a]', formFieldInput: 'bg-[#edf5f3] text-[#173943]', socialButtonsBlockButton: 'border-[#c8d8d5] bg-transparent', main: 'gap-5' },
};

function App() {
  return <QueryClientProvider client={queryClient}><WouterRouter base={basePath}><ClerkBoundary /></WouterRouter></QueryClientProvider>;
}
function ClerkBridge({ children }: { children: ReactNode }) {
  const { signOut } = useClerk();
  const { user, isLoaded, isSignedIn } = useUser();
  const value = useMemo<AuthUi>(() => ({ signedIn: !!isSignedIn, loaded: isLoaded, user: user ? { firstName: user.firstName, fullName: user.fullName, primaryEmailAddress: { emailAddress: user.primaryEmailAddress?.emailAddress } } : null, signOut: () => { void signOut({ redirectUrl: basePath || '/' }); } }), [isLoaded, isSignedIn, signOut, user]);
  return <AuthUiContext.Provider value={value}>{children}</AuthUiContext.Provider>;
}
function ClerkBoundary() {
  const [, setLocation] = useLocation();
  if (!clerkPubKey) return <Router />;
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={{ signIn: { start: { title: 'Welcome aboard', subtitle: 'Your next crossing starts here.' } }, signUp: { start: { title: 'Join the crew', subtitle: 'Keep your crossings close.' } } }} routerPush={(to: string) => setLocation(stripBase(to))} routerReplace={(to: string) => setLocation(stripBase(to), { replace: true })}><ClerkBridge><Router /></ClerkBridge></ClerkProvider>;
}

export default App;