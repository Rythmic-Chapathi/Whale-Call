import { useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import {
  BatteryCharging, Box, Check, ChevronLeft, ChevronRight, ClipboardList,
  Droplets, HeartPulse, MapPin, Minus, PackageCheck, Plus, Radio,
  RefreshCw, ShieldCheck, Snowflake, Soup, TentTree, Truck, Waves,
} from 'lucide-react';
import {
  getGetSupplyOrderQueryKey,
  getGetSupplyQueueQueryKey,
  getListSupplyCatalogQueryKey,
  getListSupplyDepotsQueryKey,
  getListIslandsQueryKey,
  SupplyCategory,
  SupplyOrderInputUrgency,
  useAgeSupplyOrder,
  useCancelSupplyOrder,
  useCreateSupplyOrder,
  useGetSupplyOrder,
  useGetSupplyQueue,
  useListIslands,
  useListSupplyCatalog,
  useListSupplyDepots,
} from '@workspace/api-client-react';
import type { SupplyCatalogItem, SupplyOrder, SupplyOrderInput } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { CaribbeanMap } from '@/components/CaribbeanMap';

const categoryMeta = {
  medical: { label: 'Medical', icon: HeartPulse, note: 'Care kits, oxygen and medicine' },
  water: { label: 'Water', icon: Droplets, note: 'Drinking water and purification' },
  food: { label: 'Food', icon: Soup, note: 'Rations and infant supplies' },
  power: { label: 'Power', icon: BatteryCharging, note: 'Generators, fuel and batteries' },
  shelter: { label: 'Shelter', icon: TentTree, note: 'Tarps and dry blankets' },
  comms: { label: 'Comms', icon: Radio, note: 'Handsets to stay on channel' },
} as const;

function apiMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object') {
    const data = (error as { data?: { error?: string; remedy?: string } }).data;
    if (data?.error) return `${data.error}${data.remedy ? ` ${data.remedy}` : ''}`;
  }
  return error instanceof TypeError ? fallback : error instanceof Error ? error.message.replace(/^HTTP \d+[^:]*:\s*/, '') : fallback;
}

function SupplyButton({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-amber-600 px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-45 ${className}`}>{children}</button>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="font-mono-ui text-[10px] uppercase tracking-[.19em] text-amber-700">{children}</p>;
}

function SupplyLoading({ label }: { label: string }) {
  return <main className="mx-auto max-w-[1100px] px-5 py-16"><div className="grid min-h-[340px] place-items-center rounded-[30px] border border-amber-900/10 bg-card"><div className="text-center"><RefreshCw className="mx-auto animate-spin text-amber-600" /><p className="mt-4 text-sm font-bold">{label}</p></div></div></main>;
}

export function SupplyRequestPage() {
  const query = new URLSearchParams(window.location.search);
  const linkedEmergencyId = query.get('linkedEmergencyId');
  const presetLat = Number(query.get('lat'));
  const presetLng = Number(query.get('lng'));
  const { data: catalog, isLoading, isError, refetch } = useListSupplyCatalog({ query: { queryKey: getListSupplyCatalogQueryKey() } });
  const { data: depots } = useListSupplyDepots({ query: { queryKey: getListSupplyDepotsQueryKey() } });
  const { data: islands } = useListIslands({ query: { queryKey: getListIslandsQueryKey() } });
  const createOrder = useCreateSupplyOrder();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<SupplyCategory>(SupplyCategory.medical);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [islandId, setIslandId] = useState('');
  const [dockId, setDockId] = useState('');
  const [coordinates, setCoordinates] = useState(Boolean(linkedEmergencyId));
  const [position, setPosition] = useState({
    lat: Number.isFinite(presetLat) ? presetLat : 18.02,
    lng: Number.isFinite(presetLng) ? presetLng : -62.95,
  });
  const [urgency, setUrgency] = useState<SupplyOrderInputUrgency>(linkedEmergencyId ? SupplyOrderInputUrgency.critical : SupplyOrderInputUrgency.routine);
  const [accessibilityNeed, setAccessibilityNeed] = useState(false);
  const [note, setNote] = useState('');
  const [validation, setValidation] = useState('');
  const island = islands?.find(entry => entry.id === islandId);
  const dock = island?.docks.find(entry => entry.id === dockId);
  const lines = Object.entries(quantities).filter(([, quantity]) => quantity > 0).map(([itemId, quantity]) => ({ itemId, quantity }));
  const itemMap = new Map((catalog ?? []).map(item => [item.id, item]));
  const totalWeight = lines.reduce((sum, line) => sum + (itemMap.get(line.itemId)?.weightKg ?? 0) * line.quantity, 0);
  const totalUnits = lines.reduce((sum, line) => sum + line.quantity, 0);
  const needsCold = lines.some(line => itemMap.get(line.itemId)?.coldChain);
  const requiredBoat = totalWeight <= 250 ? 'speedboat' : totalWeight <= 450 ? 'water taxi' : totalWeight <= 900 ? 'cruiser' : totalWeight <= 1800 ? 'catamaran' : 'split run';
  const selectedItems = lines.map(line => ({ ...line, item: itemMap.get(line.itemId) })).filter(entry => entry.item);
  const maxCriticality = Math.max(1, ...selectedItems.map(entry => entry.item?.criticality ?? 1));
  const priority = (urgency === 'critical' ? 5 : urgency === 'urgent' ? 3 : 1) + (maxCriticality === 3 ? 3 : maxCriticality === 2 ? 1 : 0) + (accessibilityNeed ? 2 : 0) + (linkedEmergencyId ? 4 : 0);
  const destination = coordinates ? position : dock?.position;

  const updateQuantity = (item: SupplyCatalogItem, delta: number) => {
    const current = quantities[item.id] ?? 0;
    const next = Math.max(0, Math.min(item.maxPerOrder, item.availableTotal, current + delta));
    setQuantities({ ...quantities, [item.id]: next });
    setValidation('');
  };
  const continueFlow = () => {
    setValidation('');
    if (step === 1 && !lines.length) return setValidation('Choose at least one thing for the boat to carry.');
    if (step === 1 && requiredBoat === 'split run') return setValidation('That load is over 1,800 kg. Reduce it so one boat can carry it safely.');
    if (step === 2 && !destination) return setValidation('Choose a dock or enter manual coordinates.');
    setStep(Math.min(3, step + 1));
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!destination) return setValidation('Choose where this run should land.');
    const data: SupplyOrderInput = {
      lines,
      destinationIslandId: coordinates ? null : islandId,
      destinationDockId: coordinates ? null : dockId,
      destinationPosition: destination,
      urgency,
      accessibilityNeed,
      requesterNote: note,
      linkedEmergencyId,
    };
    createOrder.mutate({ data }, { onSuccess: order => navigate(`/run/${order.id}`) });
  };
  if (isLoading) return <SupplyLoading label="Checking every shelf" />;
  if (isError) return <main className="mx-auto max-w-[900px] px-5 py-16"><button onClick={() => refetch()} className="min-h-11 rounded-full border px-5">Try the supply channel again</button></main>;

  return <main className="mx-auto max-w-[1180px] px-5 py-10 lg:px-8 lg:py-14">
    <div className="grid gap-8 lg:grid-cols-[.68fr_1.32fr]">
      <aside>
        <SectionLabel>Supply mode · island essentials</SectionLabel>
        <h1 className="mt-4 font-display text-5xl font-semibold leading-[.94] tracking-[-.05em]">Get what the<br />island needs.</h1>
        <p className="mt-5 max-w-sm text-sm leading-6 text-muted-foreground">We find the nearest stocked shelf, match the load to a local boat, and keep you on the run from depot to dock.</p>
        <div className="mt-8 rounded-[28px] border border-amber-900/10 bg-amber-50/80 p-5">
          <div className="flex items-center gap-3"><PackageCheck className="text-amber-700" /><div><p className="text-sm font-extrabold">{totalUnits} {totalUnits === 1 ? 'item' : 'items'} · {totalWeight.toFixed(1)} kg</p><p className="mt-1 text-xs text-amber-900/65">{lines.length ? `A ${requiredBoat} can carry this.` : 'Your load summary will appear here.'}</p></div></div>
          {needsCold && <p className="mt-4 flex items-center gap-2 rounded-xl bg-white/70 p-3 text-xs font-bold text-sky-700"><Snowflake size={15} /> A refrigerated hold will be assigned.</p>}
        </div>
        <div className="mt-8 flex gap-2">{[1, 2, 3].map(index => <span key={index} className={`h-1.5 flex-1 rounded-full ${index <= step ? 'bg-amber-600' : 'bg-amber-200'}`} />)}</div>
        <p className="mt-3 font-mono-ui text-[10px] uppercase tracking-[.15em] text-muted-foreground">Step {step} of 3</p>
      </aside>
      <form onSubmit={submit} className="rounded-[32px] border border-amber-900/10 bg-card p-6 shadow-lg sm:p-9" data-testid="form-supply-order">
        {step === 1 && <>
          <h2 className="font-display text-3xl font-semibold">What do you need?</h2>
          <p className="mt-2 text-sm text-muted-foreground">Start with a shelf, then tell us how much to lift.</p>
          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(Object.keys(categoryMeta) as SupplyCategory[]).map(key => {
              const meta = categoryMeta[key]; const Icon = meta.icon; const active = category === key;
              return <button type="button" key={key} onClick={() => setCategory(key)} className={`focus-ring min-h-28 rounded-2xl border p-4 text-left transition ${active ? 'border-amber-600 bg-amber-50 text-amber-900' : 'border-border hover:bg-muted'}`} aria-pressed={active}><Icon size={22} /><span className="mt-4 block text-sm font-extrabold">{meta.label}</span><span className="mt-1 block text-[10px] leading-4 opacity-65">{meta.note}</span></button>;
            })}
          </div>
          <div className="mt-6 divide-y divide-border rounded-2xl border border-border">
            {(catalog ?? []).filter(item => item.category === category).map(item => {
              const quantity = quantities[item.id] ?? 0;
              return <div key={item.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-extrabold">{item.name}</p>{item.coldChain && <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-1 text-[9px] font-bold text-sky-700"><Snowflake size={10} /> Cold chain</span>}</div><p className="mt-1 text-xs text-muted-foreground">{item.weightKg} kg per {item.unit}</p><p className={`mt-2 text-[10px] font-bold ${item.availableTotal <= 3 ? 'text-destructive' : 'text-amber-700'}`} aria-live="polite">{item.availableTotal === 0 ? 'Out of stock' : item.availableTotal <= 3 ? `Low stock · ${item.availableTotal} left` : `${item.availableTotal} available across the islands`}</p></div>
                <div className="flex items-center gap-2"><button type="button" onClick={() => updateQuantity(item, -1)} className="focus-ring grid h-11 w-11 place-items-center rounded-full border border-border" aria-label={`Remove one ${item.name}`} disabled={!quantity}><Minus size={16} /></button><span className="w-8 text-center font-mono-ui text-sm font-bold">{quantity}</span><button type="button" onClick={() => updateQuantity(item, 1)} className="focus-ring grid h-11 w-11 place-items-center rounded-full bg-amber-600 text-white" aria-label={`Add one ${item.name}`} disabled={quantity >= Math.min(item.maxPerOrder, item.availableTotal)}><Plus size={16} /></button></div>
              </div>;
            })}
          </div>
        </>}
        {step === 2 && <>
          <h2 className="font-display text-3xl font-semibold">Where should we land it?</h2>
           <p className="mt-2 text-sm text-muted-foreground">A dock is easiest, but you can enter a landing point manually.</p>
           <label className="mt-7 flex min-h-11 items-center gap-3 rounded-2xl border border-border p-4 text-sm font-bold"><input type="checkbox" checked={coordinates} onChange={event => setCoordinates(event.target.checked)} className="h-5 w-5 accent-amber-600" />Enter manual coordinates</label>
          {!coordinates ? <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm font-bold">Island<select value={islandId} onChange={event => { setIslandId(event.target.value); setDockId(''); }} className="focus-ring min-h-11 rounded-2xl border border-border bg-background px-4"><option value="">Select an island</option>{(islands ?? []).map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-bold">Dock<select value={dockId} onChange={event => setDockId(event.target.value)} disabled={!island} className="focus-ring min-h-11 rounded-2xl border border-border bg-background px-4 disabled:opacity-50"><option value="">Select a dock</option>{(island?.docks ?? []).map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
          </div> : <div className="mt-5 grid grid-cols-2 gap-3"><label className="grid gap-2 text-sm font-bold">Latitude<input type="number" step="any" value={position.lat} onChange={event => setPosition({ ...position, lat: Number(event.target.value) })} className="focus-ring min-h-11 rounded-2xl border bg-background px-4" /></label><label className="grid gap-2 text-sm font-bold">Longitude<input type="number" step="any" value={position.lng} onChange={event => setPosition({ ...position, lng: Number(event.target.value) })} className="focus-ring min-h-11 rounded-2xl border bg-background px-4" /></label></div>}
          <div className="mt-6"><CaribbeanMap islands={islands ?? []} boats={[]} pickupId={depots?.[0]?.islandId} destinationId={coordinates ? undefined : islandId} targetPosition={coordinates ? position : undefined} className="min-h-[360px] sm:min-h-[430px]" /></div>
          <p className="mt-6 text-sm font-extrabold">How quickly is this needed?</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">{([{ value: SupplyOrderInputUrgency.routine, label: 'Routine', note: 'Next safe launch' }, { value: SupplyOrderInputUrgency.urgent, label: 'Urgent', note: 'Move it forward' }, { value: SupplyOrderInputUrgency.critical, label: 'Critical', note: 'Lives depend on it' }] as const).map(option => <button type="button" key={option.value} onClick={() => setUrgency(option.value)} className={`focus-ring min-h-20 rounded-2xl border p-3 text-left ${urgency === option.value ? 'border-amber-600 bg-amber-50' : 'border-border'}`}><span className="block text-xs font-extrabold">{option.label}</span><span className="mt-1 block text-[10px] text-muted-foreground">{option.note}</span></button>)}</div>
          <label className="mt-5 flex min-h-11 items-center gap-3 rounded-2xl bg-muted p-4 text-sm font-bold"><input type="checkbox" checked={accessibilityNeed} onChange={event => setAccessibilityNeed(event.target.checked)} className="h-5 w-5 accent-amber-600" />Someone at this dock cannot carry it up unaided</label>
          <label className="mt-5 grid gap-2 text-sm font-bold">Note for the crew<textarea rows={3} value={note} onChange={event => setNote(event.target.value)} className="focus-ring rounded-2xl border border-border bg-background p-4 font-normal" placeholder="Landmarks, timing, or who will meet the boat" /></label>
        </>}
        {step === 3 && <>
          <h2 className="font-display text-3xl font-semibold">Ready to send?</h2>
          <p className="mt-2 text-sm text-muted-foreground">The nearest stocked shelf and capable boat will be chosen together.</p>
          <div className="mt-7 divide-y divide-border rounded-2xl border border-border">
            {selectedItems.map(entry => <div key={entry.itemId} className="flex items-center justify-between gap-4 p-4"><div><p className="text-sm font-extrabold">{entry.item?.name}</p><p className="mt-1 text-xs text-muted-foreground">Nearest stocked depot · {entry.item?.weightKg} kg each</p></div><p className="font-mono-ui text-sm font-bold">×{entry.quantity}</p></div>)}
            <div className="grid gap-3 p-4 sm:grid-cols-3"><div><p className="text-[10px] uppercase text-muted-foreground">Load</p><p className="mt-1 text-sm font-bold">{totalWeight.toFixed(1)} kg · {requiredBoat}</p></div><div><p className="text-[10px] uppercase text-muted-foreground">Landing</p><p className="mt-1 text-sm font-bold">{coordinates ? `${position.lat.toFixed(3)}, ${position.lng.toFixed(3)}` : `${island?.name ?? '—'} · ${dock?.name ?? '—'}`}</p></div><div><p className="text-[10px] uppercase text-muted-foreground">Fare</p><p className="mt-1 text-sm font-bold">{linkedEmergencyId ? 'No charge · active rescue' : 'Calculated with the route'}</p></div></div>
          </div>
          <div className="mt-5 rounded-2xl bg-amber-50 p-5 text-amber-950"><p className="font-display text-2xl font-semibold">Priority {priority.toFixed(1)}</p><p className="mt-2 text-xs leading-5">{maxCriticality === 3 ? 'Life-critical supplies' : urgency === 'routine' ? 'Routine island need' : `${urgency} island need`}{accessibilityNeed ? ', carry-up help needed' : ''}{linkedEmergencyId ? ', attached to a rescue' : ''}. Unanswered requests get louder over time.</p></div>
          {createOrder.isError && <p className="mt-5 rounded-2xl bg-destructive/10 p-4 text-sm font-bold text-destructive" role="alert">{apiMessage(createOrder.error, 'The supply radio could not connect. Check your connection and try again.')}</p>}
        </>}
        {validation && <p className="mt-5 rounded-2xl bg-destructive/10 p-4 text-sm font-bold text-destructive" role="alert">{validation}</p>}
        <div className="mt-8 flex items-center justify-between gap-3">
          {step > 1 ? <button type="button" onClick={() => setStep(step - 1)} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-5 text-sm font-bold"><ChevronLeft size={16} /> Back</button> : <Link href="/" className="inline-flex min-h-11 items-center text-sm font-bold text-muted-foreground">Cancel</Link>}
          {step < 3 ? <SupplyButton type="button" onClick={continueFlow}>Continue <ChevronRight size={16} /></SupplyButton> : <SupplyButton type="submit" disabled={createOrder.isPending}>{createOrder.isPending ? 'Calling the depots…' : 'Send the run'} <Waves size={16} /></SupplyButton>}
        </div>
      </form>
    </div>
  </main>;
}

export function SupplyTrackingPage() {
  const { id = '' } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: order, isLoading, isError, refetch } = useGetSupplyOrder(id, { query: { enabled: Boolean(id), queryKey: getGetSupplyOrderQueryKey(id), refetchInterval: 3000 } });
  const { data: catalog } = useListSupplyCatalog({ query: { queryKey: getListSupplyCatalogQueryKey() } });
  const { data: depots } = useListSupplyDepots({ query: { queryKey: getListSupplyDepotsQueryKey() } });
  const { data: islands } = useListIslands({ query: { queryKey: getListIslandsQueryKey() } });
  const cancel = useCancelSupplyOrder();
  if (isLoading) return <SupplyLoading label="Finding your supply boat" />;
  if (isError || !order) return <main className="mx-auto max-w-[900px] px-5 py-16"><button onClick={() => refetch()} className="min-h-11 rounded-full border px-5">Find this run again</button></main>;
  const itemMap = new Map((catalog ?? []).map(item => [item.id, item]));
  const depotMap = new Map((depots ?? []).map(depot => [depot.id, depot]));
  const island = islands?.find(entry => entry.id === order.destinationIslandId);
  const dock = island?.docks.find(entry => entry.id === order.destinationDockId);
  const delivered = order.status === 'delivered';
  const cancelled = order.status === 'cancelled';
  const stages = ['allocated', 'loading', 'in_transit', 'delivered'];
  const stageIndex = delivered ? 3 : order.status === 'in_transit' ? 2 : order.status === 'loading' ? 1 : 0;
  return <main className="mx-auto max-w-[1120px] px-5 py-10 lg:px-8 lg:py-14">
    <div className="flex flex-wrap items-end justify-between gap-5"><div><SectionLabel>Supply run {order.id.slice(-8)}</SectionLabel><h1 className="mt-3 font-display text-5xl font-semibold tracking-[-.05em]">{cancelled ? 'Run stood down.' : delivered ? 'Supplies on shore.' : 'Your supply boat is moving.'}</h1><p className="mt-4 text-sm text-muted-foreground" aria-live="polite">{delivered ? 'The manifest is delivered and the receipt is ready.' : cancelled ? 'Reservations are back on the shelf.' : `${order.etaMinutes ?? '—'} minutes to the landing.`}</p></div><div className="rounded-full bg-amber-100 px-4 py-2 font-mono-ui text-[10px] uppercase tracking-[.16em] text-amber-800">{order.status.replaceAll('_', ' ')}</div></div>
    <div className="mt-8 grid grid-cols-4 gap-2">{stages.map((stage, index) => <div key={stage}><span className={`block h-1.5 rounded-full ${index <= stageIndex ? 'bg-amber-600' : 'bg-amber-200'}`} /><p className="mt-2 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{stage.replace('_', ' ')}</p></div>)}</div>
    <div className="mt-8 grid gap-5 lg:grid-cols-[1.4fr_.6fr]">
      <div><CaribbeanMap islands={islands ?? []} boats={order.boat ? [order.boat] : []} pickupId={depotMap.get(order.lines[0]?.depotId)?.islandId} destinationId={order.destinationIslandId ?? undefined} targetPosition={order.destinationIslandId ? undefined : order.destinationPosition} className="min-h-[520px] sm:min-h-[640px]" /></div>
      <aside className="rounded-[30px] border border-amber-900/10 bg-card p-6">
        <SectionLabel>Run manifest</SectionLabel>
        <div className="mt-5 divide-y divide-border">{order.lines.map((line, index) => <div key={`${line.itemId}-${line.depotId}-${index}`} className="py-4"><div className="flex justify-between gap-4"><p className="text-sm font-extrabold">{itemMap.get(line.itemId)?.name ?? line.itemId}</p><p className="font-mono-ui text-xs">×{line.quantity}</p></div><p className="mt-1 text-xs text-muted-foreground">{depotMap.get(line.depotId)?.name ?? 'Island depot'}</p></div>)}</div>
        {order.unfilledLines.length > 0 && <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-xs font-bold text-amber-900">Partial fill: {order.unfilledLines.map(line => `${line.quantity} ${itemMap.get(line.itemId)?.name ?? line.itemId}`).join(', ')} remain flagged for the next run.</div>}
        <div className="mt-5 grid gap-3 border-t border-border pt-5"><p className="flex justify-between text-xs"><span className="text-muted-foreground">Landing</span><strong>{island ? `${island.name} · ${dock?.name ?? 'coordinates'}` : `${order.destinationPosition.lat.toFixed(3)}, ${order.destinationPosition.lng.toFixed(3)}`}</strong></p><p className="flex justify-between text-xs"><span className="text-muted-foreground">Boat</span><strong>{order.boat?.name ?? 'Allocating'}</strong></p><p className="flex justify-between text-xs"><span className="text-muted-foreground">Captain</span><strong>{order.boat?.assignedDriver.name ?? 'On channel'} · {order.boat?.assignedDriver.rating.toFixed(1) ?? '—'}</strong></p><p className="flex justify-between text-xs"><span className="text-muted-foreground">Load</span><strong>{order.totalWeightKg.toFixed(1)} kg</strong></p><p className="flex justify-between text-xs"><span className="text-muted-foreground">Fare</span><strong>{order.fare === 0 ? 'No charge · rescue' : `$${order.fare.toFixed(2)}`}</strong></p></div>
        {!delivered && !cancelled && ['allocated', 'partially_filled'].includes(order.status) && <button onClick={() => cancel.mutate({ supplyOrderId: order.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetSupplyOrderQueryKey(order.id) }) })} className="focus-ring mt-6 min-h-11 w-full rounded-full border border-border text-sm font-bold">Cancel this run</button>}
      </aside>
    </div>
    {delivered && <Receipt order={order} islandName={island?.name} dockName={dock?.name} />}
  </main>;
}

function Receipt({ order, islandName, dockName }: { order: SupplyOrder; islandName?: string; dockName?: string }) {
  return <section className="receipt mt-8 overflow-hidden rounded-[30px] border border-amber-900/15 bg-[#fffdf8] shadow-lg" data-testid="supply-receipt">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-dashed border-amber-900/20 bg-amber-50 p-7"><div><SectionLabel>Whale Call receipt</SectionLabel><h2 className="mt-2 font-display text-3xl font-semibold">Supply run delivered</h2></div><div className="text-right font-mono-ui text-[10px] uppercase leading-5 text-muted-foreground"><p>Receipt {order.id.toUpperCase()}</p><p>{new Date(order.deliveredAt ?? order.createdAt).toLocaleString()}</p></div></div>
    <div className="grid gap-7 p-7 md:grid-cols-2"><div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Delivered to</p><p className="mt-2 text-lg font-extrabold">{islandName ?? 'Shared coordinates'}</p><p className="text-sm text-muted-foreground">{dockName ?? `${order.destinationPosition.lat.toFixed(4)}, ${order.destinationPosition.lng.toFixed(4)}`}</p><p className="mt-5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Captain & vessel</p><p className="mt-2 text-sm font-extrabold">{order.boat?.assignedDriver.name} · {order.boat?.name}</p></div><div className="rounded-2xl bg-white p-5 shadow-sm"><p className="flex justify-between text-sm"><span>Supply transport</span><strong>${order.fare.toFixed(2)}</strong></p><p className="mt-3 flex justify-between text-sm"><span>Priority adjustment</span><strong>{order.fare === 0 ? 'Emergency waiver' : 'Included'}</strong></p><p className="mt-5 flex justify-between border-t border-dashed pt-5 text-lg"><strong>Total paid</strong><strong>${order.fare.toFixed(2)}</strong></p></div></div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-amber-900/20 px-7 py-5"><p className="flex items-center gap-2 text-xs font-bold text-amber-800"><ShieldCheck size={15} /> Manifest closed · boat returned to service</p><button onClick={() => window.print()} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-amber-900/20 px-5 text-sm font-bold"><ClipboardList size={16} /> Print receipt</button></div>
  </section>;
}

export function SupplyDispatchPage() {
  const queryClient = useQueryClient();
  const { data: queue, isLoading, isError, refetch } = useGetSupplyQueue({ query: { queryKey: getGetSupplyQueueQueryKey(), refetchInterval: 3000 } });
  const age = useAgeSupplyOrder();
  const { data: catalog } = useListSupplyCatalog({ query: { queryKey: getListSupplyCatalogQueryKey() } });
  const { data: islands } = useListIslands({ query: { queryKey: getListIslandsQueryKey() } });
  const itemMap = new Map((catalog ?? []).map(item => [item.id, item]));
  if (isLoading) return <SupplyLoading label="Opening the dispatch board" />;
  if (isError) return <main className="mx-auto max-w-[900px] px-5 py-16"><button onClick={() => refetch()} className="min-h-11 rounded-full border px-5">Reopen dispatch</button></main>;
  return <main className="mx-auto max-w-[1240px] px-5 py-10 lg:px-8 lg:py-14"><div className="flex flex-wrap items-end justify-between gap-5"><div><SectionLabel>Live dispatcher view</SectionLabel><h1 className="mt-3 font-display text-5xl font-semibold tracking-[-.05em]">The loudest need rises.</h1><p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">Priority includes urgency, critical supplies, accessibility, active rescues, and the time each request has waited.</p></div><Link href="/supplies" className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full bg-amber-600 px-5 text-sm font-bold text-white"><Plus size={16} /> New supply run</Link></div>
    <div className="mt-10 space-y-3" aria-live="polite">{(queue ?? []).length === 0 ? <div className="rounded-[28px] border border-dashed p-12 text-center"><PackageCheck className="mx-auto text-amber-600" /><h2 className="mt-4 font-display text-2xl">Every run is accounted for.</h2></div> : (queue ?? []).map(order => {
      const island = islands?.find(entry => entry.id === order.destinationIslandId);
      return <article key={order.id} className="grid gap-4 rounded-[26px] border border-amber-900/10 bg-card p-5 transition-all md:grid-cols-[90px_1.4fr_1fr_auto] md:items-center"><div><p className="font-display text-4xl font-semibold text-amber-700">{order.priorityScore.toFixed(1)}</p><p className="font-mono-ui text-[9px] uppercase text-muted-foreground">Priority</p></div><div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-amber-100 px-2 py-1 text-[9px] font-extrabold uppercase text-amber-800">{order.urgency}</span><span className="rounded-full bg-muted px-2 py-1 text-[9px] font-extrabold uppercase">{order.status.replaceAll('_', ' ')}</span></div><p className="mt-2 text-sm font-extrabold">{order.priorityReason}</p><p className="mt-1 text-xs text-muted-foreground">{order.requestedLines.map(line => `${line.quantity} ${itemMap.get(line.itemId)?.name ?? line.itemId}`).join(' · ')}</p></div><div><p className="text-sm font-bold">{island?.name ?? `${order.destinationPosition.lat.toFixed(2)}, ${order.destinationPosition.lng.toFixed(2)}`}</p><p className="mt-1 text-xs text-muted-foreground">{order.boat?.name ?? 'Boat unassigned'} · {Math.max(0, Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60_000))} min waiting</p></div><div className="flex gap-2"><Link href={`/run/${order.id}`} className="focus-ring inline-flex min-h-11 items-center rounded-full border border-border px-4 text-xs font-bold">Track</Link>{import.meta.env.DEV && <button onClick={() => age.mutate({ supplyOrderId: order.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetSupplyQueueQueryKey() }) })} className="focus-ring min-h-11 rounded-full bg-amber-100 px-4 text-xs font-bold text-amber-900">+5 min</button>}</div></article>;
    })}</div>
  </main>;
}