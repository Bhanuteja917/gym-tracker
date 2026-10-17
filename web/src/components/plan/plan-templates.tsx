'use client';

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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { applyPlanTemplate, applyTemplateDay } from '@/local/mutations';
import { useLocal } from '@/local/provider';
import { dayName, formatTarget, WEEKDAY_LABELS, WEEKDAYS, type Weekday } from '@/lib/plan';
import { PLAN_TEMPLATES, type PlanTemplate } from '@/lib/plan-templates';

/**
 * The built-in plans. Without `day`, a template replaces the whole week;
 * with it, tapping one of a template's days copies it into that day.
 * Exercises the user doesn't have yet are added.
 */
export function PlanTemplates({ trigger, day }: { trigger: ReactNode; day?: Weekday }) {
  const { mutate } = useLocal();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<PlanTemplate | null>(null);
  const [pending, startTransition] = useTransition();

  function run(task: Parameters<typeof mutate>[0], message: string) {
    startTransition(async () => {
      const result = await mutate(task);
      if (!result.ok) return void toast.error(result.error);
      toast.success(message);
      setOpen(false);
      setConfirm(null);
    });
  }

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="bottom" className="flex h-[85dvh] flex-col gap-0 rounded-t-2xl p-0">
          <SheetHeader className="border-b">
            <SheetTitle>{day ? `Template day for ${WEEKDAY_LABELS[day]}` : 'Plan templates'}</SheetTitle>
            <SheetDescription>
              {day ? 'Tap a day to copy its exercises here.' : 'Replaces your week. You can change any day afterwards.'}
            </SheetDescription>
          </SheetHeader>
          <div
            className="flex-1 space-y-6 overflow-y-auto p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
            aria-busy={pending}
          >
            {PLAN_TEMPLATES.map((template) => (
              <section key={template.id} className="space-y-2">
                <div>
                  <h3 className="font-semibold">{template.name}</h3>
                  <p className="text-muted-foreground text-sm">{template.description}</p>
                </div>
                <ul className="bg-card divide-y rounded-xl border text-sm">
                  {WEEKDAYS.filter((d) => !day || template.days[d].items.length > 0).map((d) => {
                    const value = template.days[d];
                    const body = (
                      <>
                        <p className="font-medium">
                          {!day && (
                            <span className="text-muted-foreground mr-2 inline-block w-8">
                              {WEEKDAY_LABELS[d].slice(0, 3)}
                            </span>
                          )}
                          {value.items.length === 0 ? 'Rest' : value.title}
                        </p>
                        {value.items.length > 0 && (
                          <p className="text-muted-foreground mt-0.5">
                            {value.items.map((i) => `${i.exercise.name} ${formatTarget(i)}`).join(' · ')}
                          </p>
                        )}
                      </>
                    );
                    return (
                      <li key={d}>
                        {day ? (
                          <button
                            type="button"
                            disabled={pending}
                            className="active:bg-accent w-full px-3 py-2.5 text-left"
                            onClick={() =>
                              run((db) => applyTemplateDay(db, day, value), `${WEEKDAY_LABELS[day]}: ${dayName(value)}`)
                            }
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
                {!day && (
                  <Button className="w-full" disabled={pending} onClick={() => setConfirm(template)}>
                    Use this plan
                  </Button>
                )}
              </section>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace your week?</AlertDialogTitle>
            <AlertDialogDescription>
              Every day of your plan is replaced with “{confirm?.name}”. Your logged workouts aren’t changed, and
              exercises you already log under a similar name are reused.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                if (confirm) run((db) => applyPlanTemplate(db, confirm.days), 'Plan updated');
              }}
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
