'use client';

import { Copy, Pencil, Plus } from 'lucide-react';
import { type ReactNode, useState, useTransition } from 'react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import type { GymDB } from '@/local/db';
import { applyPlanTemplate, applyTemplateDay, applyUserTemplate, copyPlanDay, createTemplate } from '@/local/mutations';
import { useLocal, useLocalQuery } from '@/local/provider';
import { getSettings, listExercises } from '@/local/queries';
import { navigate } from '@/local/router';
import { dayName, formatTarget, WEEKDAY_LABELS, WEEKDAYS, type Weekday } from '@/lib/plan';
import { PLAN_TEMPLATES } from '@/lib/plan-templates';

type DayRow = { day: Weekday; title: string; summary: string[]; copy: (db: GymDB) => Promise<void> };
type TemplateView = {
  key: string;
  name: string;
  description?: string;
  days: DayRow[];
  /** Replaces the week with it. */
  use: (db: GymDB) => Promise<void>;
  /** Your own template: its id, for editing. */
  editId?: string;
  /** A built-in one, which can be copied to your templates. */
  builtIn?: boolean;
};

/**
 * The templates: the user's own, then the built-in ones. Without `day`, a
 * template replaces the whole week, and templates can be created; with it,
 * tapping one of a template's days copies it into that day (of the plan, or
 * of the template `templateId` being edited). Built-in exercises the user
 * doesn't have yet are added.
 */
export function PlanTemplates({
  trigger,
  day,
  templateId,
}: {
  trigger: ReactNode;
  day?: Weekday;
  templateId?: string;
}) {
  const { mutate } = useLocal();
  const settings = useLocalQuery(getSettings, []);
  const exercises = useLocalQuery(listExercises, []);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<TemplateView | null>(null);
  const [naming, setNaming] = useState<{ from: 'week' | 'empty' | TemplateView; name: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function run<T>(task: (db: GymDB) => Promise<T>, message: string, then?: (result: T) => void) {
    startTransition(async () => {
      const result = await mutate(task);
      if (!result.ok) return void toast.error(result.error);
      toast.success(message);
      setOpen(false);
      setConfirm(null);
      setNaming(null);
      then?.(result.data);
    });
  }

  const names = new Map((exercises ?? []).map((e) => [e.id, e.name]));
  const mine: TemplateView[] = (settings?.planTemplates ?? []).map((t) => ({
    key: t.id,
    name: t.name,
    editId: t.id,
    use: (db) => applyUserTemplate(db, t.id),
    days: WEEKDAYS.map((d) => {
      const items = t.days[d].items.filter((i) => names.has(i.exerciseId));
      return {
        day: d,
        title: dayName({ ...t.days[d], items }),
        summary: items.map((i) => `${names.get(i.exerciseId)} ${formatTarget(i)}`),
        copy: (db) => copyPlanDay(db, day!, { ...t.days[d], items }, templateId),
      };
    }),
  }));
  const builtIn: TemplateView[] = PLAN_TEMPLATES.map((t) => ({
    key: t.id,
    name: t.name,
    description: t.description,
    use: (db) => applyPlanTemplate(db, t.days),
    builtIn: true,
    days: WEEKDAYS.map((d) => ({
      day: d,
      title: dayName(t.days[d]),
      summary: t.days[d].items.map((i) => `${i.exercise.name} ${formatTarget(i)}`),
      copy: (db) => applyTemplateDay(db, day!, t.days[d], templateId),
    })),
  }));

  function saveNew() {
    if (!naming) return;
    const { from, name } = naming;
    const task =
      from === 'week' || from === 'empty'
        ? (db: GymDB) => createTemplate(db, name, from)
        : (db: GymDB) => createTemplate(db, name, PLAN_TEMPLATES.find((t) => t.id === from.key)!.days);
    run(task, 'Template saved', (id) => navigate(`/plan/template?id=${id}`));
  }

  function section(template: TemplateView) {
    const days = day ? template.days.filter((d) => d.summary.length > 0) : template.days;
    return (
      <section key={template.key} className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold">{template.name}</h3>
            {template.description && <p className="text-muted-foreground text-sm">{template.description}</p>}
          </div>
          {!day && template.editId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setOpen(false);
                navigate(`/plan/template?id=${template.editId}`);
              }}
            >
              <Pencil /> Edit
            </Button>
          )}
        </div>
        {days.length === 0 ? (
          <p className="text-muted-foreground text-sm">No days with exercises yet.</p>
        ) : (
          <ul className="bg-card divide-y rounded-xl border text-sm">
            {days.map((d) => {
              const body = (
                <>
                  <p className="font-medium">
                    {!day && (
                      <span className="text-muted-foreground mr-2 inline-block w-8">
                        {WEEKDAY_LABELS[d.day].slice(0, 3)}
                      </span>
                    )}
                    {d.title}
                  </p>
                  {d.summary.length > 0 && <p className="text-muted-foreground mt-0.5">{d.summary.join(' · ')}</p>}
                </>
              );
              return (
                <li key={d.day}>
                  {day ? (
                    <button
                      type="button"
                      disabled={pending}
                      className="active:bg-accent w-full px-3 py-2.5 text-left"
                      onClick={() => run(d.copy, `${WEEKDAY_LABELS[day]}: ${d.title}`)}
                    >
                      {body}
                    </button>
                  ) : (
                    <div className="px-3 py-2.5">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {!day && (
          <div className="flex gap-2">
            <Button className="flex-1" disabled={pending} onClick={() => setConfirm(template)}>
              Use this plan
            </Button>
            {template.builtIn && (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => setNaming({ from: template, name: `My ${template.name.split(' · ')[0]} plan` })}
              >
                <Copy /> Copy to mine
              </Button>
            )}
          </div>
        )}
      </section>
    );
  }

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="bottom" className="flex h-[85dvh] flex-col gap-0 rounded-t-2xl p-0">
          <SheetHeader className="border-b">
            <SheetTitle>{day ? `Template day for ${WEEKDAY_LABELS[day]}` : 'Plan templates'}</SheetTitle>
            <SheetDescription>
              {day
                ? 'Tap a day to copy its exercises here.'
                : 'Use one to replace your week, or save your own. You can change any day afterwards.'}
            </SheetDescription>
          </SheetHeader>
          <div
            className="flex-1 space-y-6 overflow-y-auto p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
            aria-busy={pending}
          >
            <div className="space-y-4">
              <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Your templates</h2>
              {mine.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  {day ? 'None yet. Save one from Plan → Templates.' : 'None yet.'}
                </p>
              )}
              {mine.map(section)}
              {!day && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" disabled={pending} onClick={() => setNaming({ from: 'week', name: '' })}>
                    <Plus /> Save my week as a template
                  </Button>
                  <Button variant="ghost" disabled={pending} onClick={() => setNaming({ from: 'empty', name: '' })}>
                    New empty template
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Built in</h2>
              {builtIn.map(section)}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace your week?</AlertDialogTitle>
            <AlertDialogDescription>
              Every day of your plan is replaced with “{confirm?.name}”. Your logged workouts aren’t changed
              {confirm?.builtIn && ', and exercises you already log under a similar name are reused'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                if (confirm) run(confirm.use, 'Plan updated');
              }}
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={naming !== null} onOpenChange={(o) => !o && setNaming(null)}>
        <DialogContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveNew();
            }}
          >
            <DialogHeader>
              <DialogTitle>New template</DialogTitle>
              <DialogDescription>
                {naming?.from === 'week'
                  ? 'Saves a copy of your current week. Changing one later doesn’t change the other.'
                  : naming?.from === 'empty'
                    ? 'Starts with every day as a rest day. Add exercises to each day.'
                    : 'Saves a copy you can change.'}
              </DialogDescription>
            </DialogHeader>
            <Input
              aria-label="Template name"
              placeholder="e.g. Bulk 5-day, Travel week"
              maxLength={40}
              autoFocus
              value={naming?.name ?? ''}
              onChange={(e) => setNaming((n) => n && { ...n, name: e.target.value })}
            />
            <DialogFooter>
              <Button type="submit" disabled={pending || !naming?.name.trim()}>
                Save template
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
