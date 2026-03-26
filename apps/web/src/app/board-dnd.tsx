"use client";

import {
  type DraggableAttributes,
  useDroppable,
} from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { type SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import { ReactNode } from 'react';

export const toBucketDragId = (bucketLabel: string) => `bucket:${bucketLabel}`;
export const toOperationDragId = (operationId: string) => `operation:${operationId}`;

export const parseBucketDragId = (id: string) =>
  id.startsWith('bucket:') ? id.slice('bucket:'.length) : null;

export const parseOperationDragId = (id: string) =>
  id.startsWith('operation:') ? id.slice('operation:'.length) : null;

type BoardBucketProps = {
  bucketLabel: string;
  ariaLabel: string;
  count: number;
  title: ReactNode;
  children: ReactNode;
};

export function BoardBucket({ bucketLabel, ariaLabel, count, title, children }: BoardBucketProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: toBucketDragId(bucketLabel),
    data: {
      type: 'bucket',
      bucketLabel,
    },
  });

  return (
    <section
      ref={setNodeRef}
      aria-label={ariaLabel}
      className={`rounded border p-4 transition-colors ${
        isOver ? 'border-sky-300 bg-sky-50' : 'bg-slate-50'
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
          {count}
        </span>
      </div>

      {children}
    </section>
  );
}

type SortableOperationItemProps = {
  operationId: string;
  bucketLabel: string;
  children: (props: {
    dragHandleAttributes: DraggableAttributes;
    dragHandleListeners: SyntheticListenerMap | undefined;
    isDragging: boolean;
  }) => ReactNode;
};

export function SortableOperationItem({
  operationId,
  bucketLabel,
  children,
}: SortableOperationItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: toOperationDragId(operationId),
    data: {
      type: 'operation',
      operationId,
      bucketLabel,
    },
  });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`rounded border bg-white p-3 shadow-sm ${
        isDragging ? 'opacity-60 ring-2 ring-sky-300' : ''
      }`}
    >
      {children({
        dragHandleAttributes: attributes,
        dragHandleListeners: listeners,
        isDragging,
      })}
    </li>
  );
}
