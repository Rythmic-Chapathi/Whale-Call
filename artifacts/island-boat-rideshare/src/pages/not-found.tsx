import { ArrowLeft, LifeBuoy } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return <main className="grid min-h-[100dvh] place-items-center bg-sidebar px-5 text-sidebar-foreground">
    <div className="w-full max-w-xl text-center">
      <img src="/whale-call-logo.png" alt="Whale Call" className="mx-auto h-16 w-16 rounded-[20px] object-cover" />
      <p className="mt-8 font-mono-ui text-[10px] uppercase tracking-[.22em] text-secondary" data-testid="text-404-kicker">Off the chart</p>
      <h1 className="mt-4 font-display text-6xl font-semibold tracking-[-.06em] sm:text-8xl" data-testid="text-404-title">That dock<br />isn't here.</h1>
      <p className="mx-auto mt-6 max-w-sm text-sm leading-6 text-sidebar-foreground/60" data-testid="text-404-message">This page drifted beyond our map. Head back to a known island or open Response mode if you need a real hand.</p>
      <div className="mt-9 flex flex-wrap justify-center gap-3"><Link href="/" className="inline-flex items-center gap-2 rounded-full bg-secondary px-5 py-3 text-sm font-extrabold text-sidebar" data-testid="link-404-home"><ArrowLeft size={16} />Back to the bay</Link><Link href="/emergency" className="inline-flex items-center gap-2 rounded-full border border-sidebar-foreground/20 px-5 py-3 text-sm font-bold" data-testid="link-404-emergency"><LifeBuoy size={16} />Response mode</Link></div>
    </div>
  </main>;
}