'use client';

import { ArrowDown, ArrowUp, ChevronLeft, LayoutTemplate, Minus, Play, Plus, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { ListSkeleton } from '@/components/list-skeleton';
import { PageHeader } from '@/components/page-header';
import { PlanTemplates } from '@/components/plan/plan-templates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ExercisePicker } from '@/components/workout/exercise-picker';
import type { LocalExercise } from '@/local/db';
import { startWorkout, updatePlanDay } from '@/local/mutations';
import { useLocal, useLocalQuery } from '@/local/provider';
import { getInProgress, getSettings, listExercises } from '@/local/queries';
import { AppLink, navigate } from '@/local/router';
import { isWeekday, MAX_PLAN_ITEMS, type PlanDay, type PlanItem, WEEKDAY_LABELS, type Weekday } from '@/lib/plan';

/**
 * Edits one day of the weekly plan, or of one of the user's templates
 * (`templateId`): its name and exercises with a target of sets × reps.
 */
export function PlanDayScreen({ day, templateId }: { day: string; templateId?: string }) {
  const settings = useLocalQuery(getSettings, []);
  const exercises = useLocalQuery(listExercises, []);
  const inProgress = useLocalQuery(getInProgress, []);

  const template = templateId ? settings?.planTemplates.find((t) => t.id === templateId) : undefined;
  if (!isWeekday(day) || (settings && templateId && !template)) {
    return (
      <>
        <PageHeader title="Day not found" />
        <AppLink href="/plan" className="text-sm underline">
          Back to Plan
        </AppLink>
      </>
    );
  }
  if (!settings || !exercises || !inProgress) return <ListSkeleton rows={4} className="mt-16" />;
  return (
    <DayEditor
      key={`${templateId}-${day}`}
      day={day}
      template={template && { id: template.id, name: template.name }}
      value={template ? template.days[day] : settings.weeklyPlan[day]}
      exercises={exercises}
      workoutInProgress={inProgress.length > 0}
    />
  );
}

function DayEditor({
  day,
  template,
  value,
  exercises,
  workoutInProgress,
}: {
  day: Weekday;
  /** Set when editing a day of one of the user's templates. */
  template?: { id: string; name: string };
  value: PlanDay;
  exercises: LocalExercise[];
  workoutInProgress: boolean;
}) {
  const { mutate } = useLocal();
  const [title, setTitle] = useState(value.title);
  const [pending, startTransition] = useTransition();
  const byId = new Map(exercises.map((e) => [e.id, e]));
  // Exercises deleted on another device drop out of the plan when it's next saved.
  const items = value.items.filter((i) => byId.has(i.exerciseId));

  function save(next: Partial<PlanDay>) {
    startTransition(async () => {
      const result = await mutate((db) => updatePlanDay(db, day, { title, items, ...next }, template?.id));
      if (!result.ok) toast.error(result.error);
    });
  }

  function change(index: number, patch: Partial<PlanItem>) {
    save({ items: items.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  }

  function move(index: number, by: -1 | 1) {
    const next = [...items];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    save({ items: next });
  }

  function start() {
    startTransition(async () => {
      const result = await mutate((db) =>
        startWorkout(
          db,
          new Date(),
          items.map((i) => i.exerciseId),
        ),
      );
      if (result.ok) navigate(`/workout?id=${result.data}`);
      else toast.error(result.error);
    });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={WEEKDAY_LABELS[day]}
        subtitle={
          <>
            {template && <>Template: {template.name} · </>}
            {items.length === 0
              ? 'Rest day'
              : `${items.length} exercises · ${items.reduce((n, i) => n + i.sets, 0)} sets`}
          </>
        }
        actions={
          <Button asChild variant="ghost" size="sm">
            <AppLink href={template ? `/plan/template?id=${template.id}` : '/plan'}>
              <ChevronLeft /> {template ? 'Template' : 'Week'}
            </AppLink>
          </Button>
        }
      />

      <div className="space-y-1.5">
        <label htmlFor="plan-day-title" className="text-sm font-medium">
          Name
        </label>
        <Input
          id="plan-day-title"
          placeholder="e.g. Upper A, Push, Legs"
          value={title}
          maxLength={40}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== value.title && save({ title })}
          enterKeyHint="done"
        />
      </div>

      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">No exercises: this is a rest day. Add exercises to train.</p>
      ) : (
        <ol className="space-y-2" aria-busy={pending}>
          {items.map((item, index) => {
            const exercise = byId.get(item.exerciseId)!;
            return (
              <li key={`${item.exerciseId}-${index}`} className="bg-card rounded-xl border p-3">
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground w-5 pt-0.5 text-sm tabular-nums">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <AppLink href={`/exercise?id=${exercise.id}`} className="font-medium">
                      {exercise.name}
                    </AppLink>
                    {exercise.muscleGroup && <p className="text-muted-foreground text-xs">{exercise.muscleGroup}</p>}
                  </div>
                  <div className="flex shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label="Move up"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label="Move down"
                      disabled={index === items.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Remove ${exercise.name}`}
                      onClick={() => save({ items: items.filter((_, i) => i !== index) })}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-3 pl-7">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      aria-label="Fewer sets"
                      disabled={item.sets <= 1}
                      onClick={() => change(index, { sets: item.sets - 1 })}
                    >
                      <Minus />
                    </Button>
                    <span className="w-14 text-center text-sm tabular-nums">
                      {item.sets} set{item.sets === 1 ? '' : 's'}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      aria-label="More sets"
                      disabled={item.sets >= 20}
                      onClick={() => change(index, { sets: item.sets + 1 })}
                    >
                      <Plus />
                    </Button>
                  </div>
                  <span className="text-muted-foreground text-sm">×</span>
                  <RepsInput value={item.reps} onSave={(reps) => change(index, { reps })} />
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {items.length < MAX_PLAN_ITEMS && (
        <ExercisePicker
          exercises={exercises.filter((e) => !e.archived)}
          onPick={(db, exerciseId) =>
            updatePlanDay(db, day, { title, items: [...items, { exerciseId, sets: 3, reps: '8–12' }] }, template?.id)
          }
        />
      )}

      <div className="flex flex-wrap gap-2">
        <PlanTemplates
          day={day}
          templateId={template?.id}
          trigger={
            <Button variant="outline">
              <LayoutTemplate /> Use a template day
            </Button>
          }
        />
        {items.length > 0 && (
          <Button variant="ghost" className="text-destructive" onClick={() => save({ items: [] })}>
            Make it a rest day
          </Button>
        )}
      </div>

      {items.length > 0 && !workoutInProgress && (
        <Button size="lg" className="h-12 w-full text-base" onClick={start} disabled={pending}>
          <Play /> Start this workout now
        </Button>
      )}
    </div>
  );
}

/** The rep target, saved when you leave the field. */
function RepsInput({ value, onSave }: { value: string; onSave: (reps: string) => void }) {
  const [text, setText] = useState(value);
  return (
    <Input
      aria-label="Reps"
      className="h-8 w-24"
      placeholder="8–12"
      value={text}
      maxLength={20}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const reps = text.trim().replace(/(\d)\s*-\s*(\d)/, '$1–$2');
        setText(reps);
        if (reps !== value) onSave(reps);
      }}
      enterKeyHint="done"
    />
  );
}
