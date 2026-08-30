import { useState } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v3';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';

import {
  useCreateDriverApplication,
  useListIslands,
  getListIslandsQueryKey,
  getListDriverApplicationsQueryKey,
  DriverApplicationInputBoatClassesItem,
  DriverCertification,
} from '@workspace/api-client-react';

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { AppShell } from './App';

const applySchema = z.object({
  fullName: z.string().min(2, "Name is too short").max(120),
  email: z.string().email("Invalid email"),
  phone: z.string().min(7, "Phone number is too short").max(30),
  homeIslandId: z.string().min(1, "Select a home island"),
  yearsExperience: z.coerce.number().min(0, "Experience cannot be negative").max(60, "Experience looks incorrect"),
  boatClasses: z.array(z.nativeEnum(DriverApplicationInputBoatClassesItem)).min(1, "Select at least one boat class"),
  languages: z.array(z.string()).min(1, "Select at least one language"),
  certifications: z.array(z.nativeEnum(DriverCertification)).min(1, "Select at least one certification"),
  availability: z.string().min(2, "Required").max(160),
  experience: z.string().min(80, "Tell us more (min 80 characters)").max(2000),
  safetyRecord: z.string().min(80, "Tell us more (min 80 characters)").max(2000),
  motivation: z.string().min(80, "Tell us more (min 80 characters)").max(2000),
  consent: z.literal(true, { message: "You must consent to background checks" })
});

export function DriverApplyPage() {
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: islands } = useListIslands({ query: { queryKey: getListIslandsQueryKey() } });
  const createApplication = useCreateDriverApplication();

  const form = useForm<z.infer<typeof applySchema>>({
    resolver: zodResolver(applySchema as any),
    defaultValues: {
      fullName: '', email: '', phone: '', homeIslandId: '', yearsExperience: 0,
      boatClasses: [], languages: [], certifications: [], availability: '',
      experience: '', safetyRecord: '', motivation: '',
    },
  });

  const onSubmit = (values: z.infer<typeof applySchema>) => {
    setDuplicateError(false);
    createApplication.mutate({ data: { ...values, consent: true } }, {
      onSuccess: (data) => {
        setSubmittedId(data.id);
        queryClient.invalidateQueries({ queryKey: getListDriverApplicationsQueryKey() });
      },
      onError: (err: any) => {
        if (err?.data?.code === 'DUPLICATE_APPLICATION') {
          setDuplicateError(true);
        } else {
          const field = err?.data?.field;
          const message = err?.data?.error || 'We could not submit your application. Please try again.';
          if (field && field in form.getValues()) {
            form.setError(field as keyof z.infer<typeof applySchema>, { message });
          } else {
            form.setError('root', { message });
          }
        }
      }
    });
  };

  const watchExperience = form.watch("experience") || "";
  const watchSafety = form.watch("safetyRecord") || "";
  const watchMotivation = form.watch("motivation") || "";

  if (submittedId) {
    return (
      <AppShell>
        <main className="mx-auto max-w-2xl px-5 py-24 text-center">
          <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-accent/20 text-accent">
            <ShieldCheck size={48} />
          </div>
          <h1 className="mt-8 font-display text-4xl font-semibold">Application submitted</h1>
          <p className="mt-4 text-muted-foreground">Thanks for stepping up to the helm. We’ll review your credentials and be in touch soon.</p>
          <div className="mt-8 rounded-2xl bg-card p-6 border shadow-sm">
            <p className="text-sm uppercase tracking-widest text-muted-foreground font-mono-ui">Application ID</p>
            <p className="mt-2 break-all text-lg font-mono-ui font-bold text-foreground">{submittedId}</p>
          </div>
          <Button onClick={() => setLocation('/')} className="mt-10">Return home</Button>
        </main>
      </AppShell>
    );
  }

  const LANGS = ['English', 'Spanish', 'French', 'Dutch', 'Creole'];

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl px-5 py-16 lg:py-24">
        <div>
          <h1 className="font-display text-5xl font-semibold tracking-tight">Become a captain</h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-xl">Join our network of trusted local captains. Provide your details below for dockmaster review.</p>
        </div>
        
        {duplicateError && (
          <div className="mt-8 rounded-2xl border border-destructive/25 bg-destructive/10 p-5 flex items-start gap-4 text-destructive">
            <AlertCircle size={24} className="shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold">Application already pending</h3>
              <p className="text-sm opacity-90 mt-1">We already have an active application with this email or phone number. Please wait for the dockmaster to review it.</p>
            </div>
          </div>
        )}

        <div className="mt-12 rounded-[28px] border bg-card p-8 shadow-sm">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              <div className="grid gap-6 md:grid-cols-2">
                <FormField control={form.control} name="fullName" render={({ field }) => (
                  <FormItem><FormLabel>Full name</FormLabel><FormControl><Input {...field} data-testid="input-fullname" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email address</FormLabel><FormControl><Input type="email" {...field} data-testid="input-email" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Phone number</FormLabel><FormControl><Input type="tel" {...field} data-testid="input-phone" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="homeIslandId" render={({ field }) => (
                  <FormItem><FormLabel>Home island</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger data-testid="select-island"><SelectValue placeholder="Select island" /></SelectTrigger></FormControl><SelectContent>{islands?.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                )} />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <FormField control={form.control} name="yearsExperience" render={({ field }) => (
                  <FormItem><FormLabel>Years of experience</FormLabel><FormControl><Input type="number" {...field} data-testid="input-experience-years" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="availability" render={({ field }) => (
                  <FormItem><FormLabel>General availability</FormLabel><FormControl><Input placeholder="e.g. Mon-Fri, mornings" {...field} data-testid="input-availability" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="space-y-4">
                <p className="text-base font-semibold">Boat classes you can operate</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[DriverApplicationInputBoatClassesItem.water_taxi, DriverApplicationInputBoatClassesItem.cruiser, DriverApplicationInputBoatClassesItem.catamaran, DriverApplicationInputBoatClassesItem.speedboat].map(bc => (
                    <FormField key={bc} control={form.control} name="boatClasses" render={({ field }) => {
                      return (
                        <FormItem key={bc} className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox checked={field.value?.includes(bc)} onCheckedChange={(checked) => {
                              return checked
                                ? field.onChange([...field.value, bc])
                                : field.onChange(field.value?.filter((value) => value !== bc));
                            }} data-testid={`checkbox-boat-${bc}`} />
                          </FormControl>
                          <FormLabel className="font-normal capitalize">{bc.replace('_', ' ')}</FormLabel>
                        </FormItem>
                      );
                    }} />
                  ))}
                </div>
                {form.formState.errors.boatClasses && <p className="text-sm font-medium text-destructive">{form.formState.errors.boatClasses.message}</p>}
              </div>

              <div className="space-y-4">
                <p className="text-base font-semibold">Languages spoken</p>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {LANGS.map(lang => (
                    <FormField key={lang} control={form.control} name="languages" render={({ field }) => (
                      <FormItem key={lang} className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value?.includes(lang)} onCheckedChange={(checked) => {
                            return checked ? field.onChange([...field.value, lang]) : field.onChange(field.value?.filter(l => l !== lang));
                          }} data-testid={`checkbox-lang-${lang}`} />
                        </FormControl>
                        <FormLabel className="font-normal">{lang}</FormLabel>
                      </FormItem>
                    )} />
                  ))}
                </div>
                {form.formState.errors.languages && <p className="text-sm font-medium text-destructive">{form.formState.errors.languages.message}</p>}
              </div>

              <div className="space-y-4">
                <p className="text-base font-semibold">Certifications</p>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {Object.values(DriverCertification).map(cert => (
                    <FormField key={cert} control={form.control} name="certifications" render={({ field }) => (
                      <FormItem key={cert} className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value?.includes(cert)} onCheckedChange={(checked) => {
                            return checked ? field.onChange([...field.value, cert]) : field.onChange(field.value?.filter(c => c !== cert));
                          }} data-testid={`checkbox-cert-${cert}`} />
                        </FormControl>
                        <FormLabel className="font-normal capitalize">{cert.replace('_', ' ')}</FormLabel>
                      </FormItem>
                    )} />
                  ))}
                </div>
                {form.formState.errors.certifications && <p className="text-sm font-medium text-destructive">{form.formState.errors.certifications.message}</p>}
              </div>

              <FormField control={form.control} name="experience" render={({ field }) => (
                <FormItem>
                  <div className="flex items-end justify-between"><FormLabel>Nautical experience</FormLabel><span className={`text-xs ${watchExperience.length < 80 ? 'text-destructive' : 'text-muted-foreground'}`}>{watchExperience.length} / 80 min</span></div>
                  <FormControl><Textarea className="min-h-32" placeholder="Tell us about your time on the water..." {...field} data-testid="input-experience" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="safetyRecord" render={({ field }) => (
                <FormItem>
                  <div className="flex items-end justify-between"><FormLabel>Safety record</FormLabel><span className={`text-xs ${watchSafety.length < 80 ? 'text-destructive' : 'text-muted-foreground'}`}>{watchSafety.length} / 80 min</span></div>
                  <FormControl><Textarea className="min-h-32" placeholder="Describe any past incidents and your safety protocols..." {...field} data-testid="input-safety" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="motivation" render={({ field }) => (
                <FormItem>
                  <div className="flex items-end justify-between"><FormLabel>Why Whale Call?</FormLabel><span className={`text-xs ${watchMotivation.length < 80 ? 'text-destructive' : 'text-muted-foreground'}`}>{watchMotivation.length} / 80 min</span></div>
                  <FormControl><Textarea className="min-h-32" placeholder="Why do you want to join our network..." {...field} data-testid="input-motivation" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="consent" render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-xl border p-4 bg-muted/30">
                  <FormControl>
                    <Checkbox checked={!!field.value} onCheckedChange={field.onChange} data-testid="checkbox-consent" />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>I consent to background checks and verification</FormLabel>
                    <p className="text-sm text-muted-foreground">By checking this box, you agree that Whale Call may verify your safety record and credentials.</p>
                  </div>
                </FormItem>
              )} />

              {form.formState.errors.root?.message && <p role="alert" className="text-sm font-medium text-destructive">{form.formState.errors.root.message}</p>}
              <Button type="submit" disabled={createApplication.isPending} className="w-full h-14 text-base mt-4" data-testid="button-submit">
                {createApplication.isPending ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Submitting</> : 'Submit application'}
              </Button>
            </form>
          </Form>
        </div>
      </main>
    </AppShell>
  );
}
