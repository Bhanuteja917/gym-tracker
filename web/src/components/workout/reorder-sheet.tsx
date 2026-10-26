'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { GripVertical } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { reorderDone } from '@/local/mutations';
import { useLocal } from '@/local/provider';
import type { WorkoutExerciseRow } from '@/local/queries';
import { cn } from '@/lib/utils';

/**
 * Drag the exercises a workout has sets for into the order they were done.
 * Each drop is saved straight away.
 */
export function ReorderSheet({
  workoutId,
  done,
  open,
  onOpenChange,
}: {
  workoutId: string;
  /** The exercises with sets, in their saved order. */
  done: WorkoutExerciseRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex max-h-[85dvh] flex-col gap-0 rounded-t-2xl p-0">
        <SheetHeader className="border-b">
          <SheetTitle>Order you did them in</SheetTitle>
          <SheetDescription>Drag an exercise by its handle. Changes are saved as you go.</SheetDescription>
        </SheetHeader>
        {/* Remounted on open so it starts from the saved order. */}
        {open && <SortableList workoutId={workoutId} done={done} />}
      </SheetContent>
    </Sheet>
  );
}

function SortableList({ workoutId, done }: { workoutId: string; done: WorkoutExerciseRow[] }) {
  const { mutate } = useLocal();
  const [order, setOrder] = useState(() => done.map((r) => r.id));
  const byId = new Map(done.map((r) => [r.id, r]));
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function dragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const previous = order;
    const next = arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id)));
    setOrder(next);
    const result = await mutate((db) => reorderDone(db, workoutId, next));
    if (!result.ok) {
      setOrder(previous);
      toast.error(result.error);
    }
  }

  return (
    <div className="overflow-y-auto p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <ol className="space-y-2">
            {order.map((id, index) => {
              const row = byId.get(id);
              return row && <SortableRow key={id} row={row} index={index} />;
            })}
          </ol>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableRow({ row, index }: { row: WorkoutExerciseRow; index: number }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  });
  return (
    <li
      ref={setNodeRef}
      // Moves along the list only.
      style={{ transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined, transition }}
      className={cn('bg-card flex items-center gap-3 rounded-xl border p-3', isDragging && 'relative z-10 shadow-lg')}
    >
      <span className="bg-muted text-muted-foreground inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs tabular-nums">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{row.exercise.name}</p>
        <p className="text-muted-foreground text-xs">
          {row.sets.length} set{row.sets.length === 1 ? '' : 's'}
        </p>
      </div>
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="text-muted-foreground -m-2 touch-none p-2"
        aria-label={`Move ${row.exercise.name}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-5" />
      </button>
    </li>
  );
}
