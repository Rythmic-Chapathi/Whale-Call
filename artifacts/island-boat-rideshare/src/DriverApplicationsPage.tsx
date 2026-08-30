import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Anchor, ArrowRight, ShieldCheck, Ship, Check, X, Loader2 } from 'lucide-react';
import {
  useListDriverApplications,
  useApproveDriverApplication,
  useRejectDriverApplication,
  getListDriverApplicationsQueryKey,
  DriverApplicationStatus,
} from '@workspace/api-client-react';

import { AppShell, LoadingCard, ErrorCard, useAuthUi } from './App';
import { Button } from '@/components/ui/button';

export function DriverApplicationsPage() {
  const { signedIn, loaded } = useAuthUi();
  const [filter, setFilter] = useState<DriverApplicationStatus>(DriverApplicationStatus.pending);
  const { data: apps, isLoading, isError, refetch } = useListDriverApplications({ status: filter }, { query: { enabled: signedIn, queryKey: getListDriverApplicationsQueryKey({ status: filter }) } });

  if (!loaded) return <AppShell><main className="mx-auto max-w-5xl px-5 py-16"><LoadingCard label="Opening dockmaster review" /></main></AppShell>;
  if (!signedIn) return <AppShell><main className="mx-auto max-w-2xl px-5 py-20 text-center"><div className="rounded-[28px] border bg-card p-10"><h1 className="font-display text-4xl font-semibold">Dockmaster sign-in required</h1><p className="mt-4 text-muted-foreground">Sign in before reviewing captain applications.</p><a href="/sign-in" className="mt-7 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground">Sign in</a></div></main></AppShell>;
  
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl px-5 py-16 lg:py-24">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">Dockmaster Review</h1>
          <p className="mt-3 text-lg text-muted-foreground">Review captain applications to join the fleet.</p>
        </div>

        <div className="mt-8 flex gap-3 border-b border-border pb-4 overflow-x-auto">
          {Object.values(DriverApplicationStatus).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-full px-5 py-2 text-sm font-semibold capitalize transition-colors ${filter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
              data-testid={`filter-${s}`}
            >
              {s}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="mt-8 grid gap-4"><LoadingCard label="Loading applications..." /></div>
        ) : isError ? (
          <div className="mt-8"><ErrorCard retry={refetch} /></div>
        ) : apps?.length ? (
          <div className="mt-8 grid gap-5">
            {apps.map(app => <ApplicationCard key={app.id} app={app} />)}
          </div>
        ) : (
          <div className="mt-8 rounded-3xl border border-dashed border-border bg-card p-12 text-center">
            <p className="font-mono-ui text-sm uppercase tracking-widest text-muted-foreground">No applications found</p>
          </div>
        )}
      </main>
    </AppShell>
  );
}

function ApplicationCard({ app }: { app: any }) {
  const queryClient = useQueryClient();
  const approve = useApproveDriverApplication();
  const reject = useRejectDriverApplication();
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const handleApprove = () => {
    approve.mutate({ applicationId: app.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDriverApplicationsQueryKey({ status: app.status }) });
        queryClient.invalidateQueries({ queryKey: getListDriverApplicationsQueryKey({ status: 'approved' as any }) });
      }
    });
  };

  const handleReject = () => {
    reject.mutate({ applicationId: app.id, data: { reason: rejectReason } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDriverApplicationsQueryKey({ status: app.status }) });
        queryClient.invalidateQueries({ queryKey: getListDriverApplicationsQueryKey({ status: 'rejected' as any }) });
        setRejectMode(false);
      }
    });
  };

  return (
    <article className="rounded-[28px] border bg-card p-6 md:p-8 shadow-sm" data-testid={`app-card-${app.id}`}>
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="font-display text-2xl font-semibold">{app.fullName}</h3>
            <span className={`rounded-full px-3 py-1 font-mono-ui text-[10px] uppercase tracking-widest ${app.status === 'pending' ? 'bg-amber-100 text-amber-800' : app.status === 'approved' ? 'bg-accent/20 text-accent-foreground' : 'bg-destructive/10 text-destructive'}`}>
              {app.status}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{app.email} • {app.phone}</p>
          <p className="mt-1 text-sm font-semibold">{app.yearsExperience} years experience</p>
        </div>
        
        {app.status === 'pending' && !rejectMode && (
          <div className="flex gap-3 shrink-0">
            <Button variant="outline" className="h-10 text-destructive border-destructive/20 hover:bg-destructive/10" onClick={() => setRejectMode(true)} disabled={approve.isPending || reject.isPending} data-testid={`btn-reject-${app.id}`}><X size={16} className="mr-2"/> Reject</Button>
            <Button className="h-10" onClick={handleApprove} disabled={approve.isPending || reject.isPending} data-testid={`btn-approve-${app.id}`}>{approve.isPending ? <Loader2 className="animate-spin" /> : <><Check size={16} className="mr-2"/> Approve</>}</Button>
          </div>
        )}
        
        {rejectMode && (
          <div className="flex gap-2 shrink-0 items-center">
            <input type="text" placeholder="Reason (optional)" value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="h-10 rounded-md border px-3 text-sm" data-testid={`input-reject-reason-${app.id}`} />
            <Button variant="outline" className="h-10" onClick={() => setRejectMode(false)} data-testid={`btn-cancel-reject-${app.id}`}>Cancel</Button>
            <Button variant="destructive" className="h-10" onClick={handleReject} disabled={reject.isPending} data-testid={`btn-confirm-reject-${app.id}`}>{reject.isPending ? <Loader2 className="animate-spin" /> : 'Confirm'}</Button>
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-6 border-t pt-6 md:grid-cols-2 lg:grid-cols-3">
        <div>
          <h4 className="font-mono-ui text-[10px] uppercase tracking-widest text-muted-foreground">Boat Classes</h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {app.boatClasses.map((bc: string) => <span key={bc} className="rounded-md bg-muted px-2 py-1 text-xs capitalize">{bc.replace('_', ' ')}</span>)}
          </div>
        </div>
        <div>
          <h4 className="font-mono-ui text-[10px] uppercase tracking-widest text-muted-foreground">Certifications</h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {app.certifications.map((c: string) => <span key={c} className="rounded-md bg-primary/10 text-primary px-2 py-1 text-xs capitalize font-medium">{c.replace('_', ' ')}</span>)}
          </div>
        </div>
        <div>
          <h4 className="font-mono-ui text-[10px] uppercase tracking-widest text-muted-foreground">Languages</h4>
          <p className="mt-2 text-sm">{app.languages.join(', ')}</p>
        </div>
      </div>
      
      <div className="mt-6 space-y-5">
        <div>
          <h4 className="font-mono-ui text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Availability</h4>
          <p className="text-sm">{app.availability}</p>
        </div>
        <div>
          <h4 className="font-mono-ui text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Experience</h4>
          <p className="text-sm text-muted-foreground">{app.experience}</p>
        </div>
        <div>
          <h4 className="font-mono-ui text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Safety Record</h4>
          <p className="text-sm text-muted-foreground">{app.safetyRecord}</p>
        </div>
      </div>
    </article>
  );
}
