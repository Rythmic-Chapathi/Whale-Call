import { useState } from 'react';
import { useParams } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v3';
import { useQueryClient } from '@tanstack/react-query';
import { Star, ShieldCheck, Ship, MessageCircle, AlertCircle, Loader2 } from 'lucide-react';
import {
  useGetDriverProfile,
  useListDriverReviews,
  useCreateDriverReview,
  getGetDriverProfileQueryKey,
  getListDriverReviewsQueryKey,
  getListFleetQueryKey,
} from '@workspace/api-client-react';

import { AppShell, LoadingCard, ErrorCard } from './App';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useAuthUi } from './App';

const reviewSchema = z.object({
  rating: z.number().min(1, "Please select a rating").max(5),
  body: z.string().min(10, "Review must be at least 10 characters").max(1000),
});

export function DriverProfilePage() {
  const { id } = useParams();
  const driverId = id!;
  const [page, setPage] = useState(1);
  const { signedIn, loaded } = useAuthUi();
  const { data: profile, isLoading, isError, refetch } = useGetDriverProfile(driverId, {
    query: {
      enabled: loaded,
      queryKey: [...getGetDriverProfileQueryKey(driverId), signedIn] as any,
    },
  });
  const { data: reviewsPage } = useListDriverReviews(driverId, page, { query: { queryKey: getListDriverReviewsQueryKey(driverId, page) } });

  if (isLoading) return <AppShell><main className="mx-auto max-w-4xl px-5 py-16"><LoadingCard label="Finding captain logs..." /></main></AppShell>;
  if (isError || !profile) return <AppShell><main className="mx-auto max-w-4xl px-5 py-16"><ErrorCard retry={refetch} message="Could not find this captain." /></main></AppShell>;

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl px-5 py-12 lg:py-20">
        <div className="grid gap-10 md:grid-cols-[1fr_340px] items-start">
          <div className="space-y-12">
            <header className="flex items-center gap-6">
              <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full bg-primary text-3xl font-display text-primary-foreground shadow-sm">
                {profile.name.split(' ').map((n: string) => n[0]).join('')}
              </div>
              <div>
                <h1 className="font-display text-4xl font-semibold tracking-tight" data-testid="text-driver-name">{profile.name}</h1>
                <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center text-secondary-foreground font-bold"><Star className="mr-1.5 fill-secondary text-secondary" size={16} /> {profile.rating.toFixed(1)}</span>
                  <span>{profile.tripsCompleted} trips</span>
                  <span>{profile.yearsActive} years active</span>
                </div>
              </div>
            </header>

            <section className="rounded-[28px] border bg-card p-8 shadow-sm">
              <h2 className="font-mono-ui text-[10px] uppercase tracking-widest text-primary">Captain Credentials</h2>
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-bold text-muted-foreground">Languages</p>
                  <p className="mt-1 font-medium">{profile.languages.join(', ')}</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-muted-foreground">Certifications</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {profile.certifications.map((c: string) => <span key={c} className="rounded-md bg-accent/10 px-2 py-1 text-xs font-semibold text-accent-foreground capitalize flex items-center gap-1"><ShieldCheck size={12}/> {c.replace('_', ' ')}</span>)}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="font-display text-3xl font-semibold">Passenger Reviews</h2>
              
              <ReviewForm driverId={driverId} canReview={profile.canReview} blockReason={profile.reviewBlockReason} />

              <div className="mt-10 space-y-6">
                {!reviewsPage?.reviews?.length ? (
                  <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
                    <MessageCircle className="mx-auto mb-3 opacity-20" size={32} />
                    <p>No reviews yet.</p>
                  </div>
                ) : (
                  reviewsPage.reviews.map((r: any) => (
                    <article key={r.id} className="rounded-2xl border bg-card p-6" data-testid={`review-${r.id}`}>
                      <div className="flex items-center justify-between">
                        <p className="font-bold">{r.reviewerName}</p>
                        <div className="flex text-secondary"><Star size={14} className="fill-secondary"/> <span className="ml-1 text-xs font-bold text-foreground">{r.rating}</span></div>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{r.body}</p>
                      <p className="mt-4 font-mono-ui text-[10px] uppercase tracking-wider text-muted-foreground/60">{new Date(r.createdAt).toLocaleDateString()}</p>
                    </article>
                  ))
                )}
                
                {reviewsPage && reviewsPage.total > reviewsPage.pageSize && (
                  <div className="flex items-center justify-center gap-4 mt-8">
                    <Button variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)} data-testid="btn-prev-page">Previous</Button>
                    <span className="text-sm font-mono-ui text-muted-foreground">Page {page} of {Math.ceil(reviewsPage.total / reviewsPage.pageSize)}</span>
                    <Button variant="outline" disabled={!reviewsPage.hasNext} onClick={() => setPage(p => p + 1)} data-testid="btn-next-page">Next</Button>
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="sticky top-24 rounded-[28px] border bg-card p-7 shadow-sm">
            <h3 className="font-mono-ui text-[10px] uppercase tracking-widest text-primary">Rating Distribution</h3>
            <div className="mt-6 flex items-end gap-4 mb-8">
              <span className="text-5xl font-display font-semibold tracking-tighter">{profile.rating.toFixed(1)}</span>
              <div className="flex text-secondary mb-1">
                {[1,2,3,4,5].map(s => <Star key={s} className={s <= Math.round(profile.rating) ? 'fill-secondary' : 'fill-transparent opacity-20'} size={20} />)}
              </div>
            </div>
            
            <div className="space-y-3">
              {[5,4,3,2,1].map(stars => {
                const count = profile.distribution[stars] || 0;
                const pct = profile.reviewCount > 0 ? (count / profile.reviewCount) * 100 : 0;
                return (
                  <div key={stars} className="flex items-center gap-3 text-xs font-mono-ui">
                    <span className="w-4">{stars}</span>
                    <Star size={12} className="text-secondary fill-secondary shrink-0" />
                    <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-secondary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-6 text-right text-muted-foreground">{count}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-6 text-xs text-muted-foreground text-center">{profile.reviewCount} total reviews</p>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}

function ReviewForm({ driverId, canReview, blockReason }: { driverId: string, canReview: boolean, blockReason: string | null }) {
  const { signedIn } = useAuthUi();
  const queryClient = useQueryClient();
  const createReview = useCreateDriverReview();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof reviewSchema>>({
    resolver: zodResolver(reviewSchema as any),
    defaultValues: { rating: 0, body: '' },
  });

  if (!signedIn) {
    return <div className="mt-8 rounded-2xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground">Sign in to leave a review.</div>;
  }

  if (!canReview) {
    return <div className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 flex items-start gap-4 text-amber-800 dark:text-amber-200">
      <AlertCircle size={20} className="shrink-0 mt-0.5" />
      <p className="text-sm font-medium">{blockReason || 'You cannot review this captain at this time.'}</p>
    </div>;
  }

  const onSubmit = (values: z.infer<typeof reviewSchema>) => {
    setServerError(null);
    createReview.mutate({ driverId, data: values }, {
      onSuccess: () => {
        form.reset();
        queryClient.invalidateQueries({ queryKey: getGetDriverProfileQueryKey(driverId) });
        queryClient.invalidateQueries({ queryKey: getListDriverReviewsQueryKey(driverId, 1) });
        queryClient.invalidateQueries({ queryKey: getListFleetQueryKey() });
        queryClient.invalidateQueries({ predicate: query => String(query.queryKey[0] ?? '').startsWith('/api/fleet/') });
      },
      onError: (err: any) => {
        if (err?.data?.code === 'DUPLICATE_REVIEW') {
          setServerError("You have already reviewed this captain for your recent trip.");
        } else if (err?.data?.code === 'TRIP_REQUIRED') {
          setServerError("You must complete a trip with this captain before reviewing.");
        } else {
          setServerError(err?.data?.error || "Failed to submit review.");
        }
      }
    });
  };

  return (
    <div className="mt-8 rounded-2xl border bg-card p-6 shadow-sm">
      <h3 className="font-bold mb-4">Leave a review</h3>
      {serverError && (
        <div className="mb-6 rounded-xl bg-destructive/10 p-4 text-sm font-medium text-destructive flex gap-3"><AlertCircle size={16} className="shrink-0 mt-0.5" /> {serverError}</div>
      )}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField control={form.control} name="rating" render={({ field }) => (
            <FormItem>
              <FormLabel className="sr-only">Rating</FormLabel>
              <FormControl>
                <div 
                  className="flex gap-2" 
                  role="radiogroup" 
                  aria-label="Rating" 
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      field.onChange(Math.min(5, (field.value || 0) + 1));
                    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      field.onChange(Math.max(1, (field.value || 0) - 1));
                    }
                  }}
                >
                  {[1,2,3,4,5].map(star => (
                    <button
                      key={star}
                      type="button"
                      role="radio"
                      aria-checked={field.value === star}
                      onClick={() => field.onChange(star)}
                      className="focus-ring rounded-full p-1 transition-transform hover:scale-110"
                      data-testid={`star-${star}`}
                    >
                      <Star size={32} className={star <= field.value ? "fill-secondary text-secondary" : "fill-transparent text-muted-foreground/30"} />
                    </button>
                  ))}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          
          <FormField control={form.control} name="body" render={({ field }) => (
            <FormItem>
              <FormLabel className="sr-only">Review</FormLabel>
              <FormControl>
                <Textarea placeholder="How was your crossing?" className="min-h-24" {...field} data-testid="input-review-body" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          
          <div className="flex justify-end">
            <Button type="submit" disabled={createReview.isPending} data-testid="btn-submit-review">
              {createReview.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : 'Post Review'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
