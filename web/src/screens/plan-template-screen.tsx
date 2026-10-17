'use client';

import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { ListSkeleton } from '@/components/list-skeleton';
import { PageHeader } from '@/components/page-header';
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
import { Input } from '@/components/ui/input';
import { applyUserTemplate, deleteTemplate, renameTemplate } from '@/local/mutations';
import { useLocal, useLocalQuery } from '@/local/provider';
import { getSettings, listExercises } from '@/local/queries';
import { AppLink, navigate } from '@/local/router';
import { dayName, type UserTemplate, WEEKDAY_LABELS, WEEKDAYS } from '@/lib/plan';
import { cn } from '@/lib/utils';

/** One of the user's templates: rename it, edit its days, use it for the week, or delete it. */
export function PlanTemplateScreen({ id }: { id: string }) {
  const settings = useLocalQuery(getSettings, []);
  const exercises = useLocalQuery(listExercises, []);
  if (!settings || !exercises) return <ListSkeleton rows={7} />;
  const template = settings.planTemplates.find((t) => t.id === id);
  if (!template) {
    return (
      <>
        <PageHeader title="Template not found" />
        <p className="text-muted-foreground text-sm">
          It may have been deleted on another device.{' '}
          <AppLink href="/plan" className="underline">
            Back to Plan
          </AppLink>
        </p>
      </>
    );
  }
  return <TemplateEditor key={id} template={template} exerciseNames={new Map(exercises.map((e) => [e.id, e.name]))} />;
}

function TemplateEditor({ template, exerciseNames }: { template: UserTemplate; exerciseNames: Map<string, string> }) {
  const { mutate } = useLocal();
  const [name, setName] = useState(template.name);
  const [confirm, setConfirm] = useState<'use' | 'delete' | null>(null);
  const [pending, startTransition] = useTransition();

  function run(task: Parameters<typeof mutate>[0], then?: () => void) {
    startTransition(async () => {
      const result = await mutate(task);
      if (!result.ok) return void toast.error(result.error);
      setConfirm(null);
      then?.();
    });
  }

  function rename() {
    if (name.trim() === template.name) return;
    if (!name.trim()) return setName(template.name);
    run((db) => renameTemplate(db, template.id, name));
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={template.name}
        subtitle="Your template"
        actions={
          <Button asChild variant="ghost" size="sm">
            <AppLink href="/plan">
              <ChevronLeft /> Plan
            </AppLink>
          </Button>
        }
      />

      <div className="space-y-1.5">
        <label htmlFor="template-name" className="text-sm font-medium">
          Name
        </label>
        <Input
          id="template-name"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onBlur={rename}
          enterKeyHint="done"
        />
      </div>

      <ul className="space-y-2" aria-busy={pending}>
        {WEEKDAYS.map((day) => {
          const value = template.days[day];
          const items = value.items.filter((i) => exerciseNames.has(i.exerciseId));
          return (
            <li key={day}>
              <AppLink
                href={`/plan/day?day=${day}&template=${template.id}`}
                className="bg-card active:bg-accent flex items-center gap-3 rounded-xl border p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    {WEEKDAY_LABELS[day]}
                  </p>
                  <p className={cn('font-semibold', items.length === 0 && 'text-muted-foreground')}>
                    {dayName({ ...value, items })}
                  </p>
                  {items.length > 0 && (
                    <p className="text-muted-foreground truncate text-sm">
                      {items.map((i) => exerciseNames.get(i.exerciseId)).join(', ')}
                    </p>
                  )}
                </div>
                <ChevronRight className="text-muted-foreground size-5 shrink-0" />
              </AppLink>
            </li>
          );
        })}
      </ul>

      <Button size="lg" className="h-12 w-full text-base" disabled={pending} onClick={() => setConfirm('use')}>
        Use this plan for my week
      </Button>
      <Button
        variant="ghost"
        className="text-destructive w-full"
        disabled={pending}
        onClick={() => setConfirm('delete')}
      >
        <Trash2 /> Delete template
      </Button>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === 'delete' ? 'Delete this template?' : 'Replace your week?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'delete'
                ? `“${template.name}” is deleted. Your weekly plan and logged workouts aren’t changed.`
                : `Every day of your plan is replaced with “${template.name}”. Your logged workouts aren’t changed.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              className={confirm === 'delete' ? 'bg-destructive text-white' : undefined}
              onClick={(e) => {
                e.preventDefault();
                if (confirm === 'delete') {
                  run(
                    (db) => deleteTemplate(db, template.id),
                    () => {
                      toast.success('Template deleted');
                      navigate('/plan', { replace: true });
                    },
                  );
                } else {
                  run(
                    (db) => applyUserTemplate(db, template.id),
                    () => {
                      toast.success('Plan updated');
                      navigate('/plan');
                    },
                  );
                }
              }}
            >
              {confirm === 'delete' ? 'Delete' : 'Replace'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
