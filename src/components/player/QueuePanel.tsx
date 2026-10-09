/**
 * Queue: now playing, drag-to-reorder "Up next" (pointer, touch and keyboard via
 * dnd-kit), "Playing from" context and this session's history.
 */
import { memo } from 'react';
import { Link } from 'react-router-dom';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ListX, Play, X } from 'lucide-react';
import { CoverImage } from '@/components/common/CoverImage';
import { Equalizer } from '@/components/common/PlayIcon';
import { shallowEqual } from '@/state/createStore';
import { usePlayer } from '@/hooks/usePlayer';
import { artistNameOf, getTrack, trackCover } from '@/services/catalog';
import { player } from '@/state/playerStore';
import type { QueueItem } from '@/types/player';
import { cn } from '@/utils/cn';
import { formatTime } from '@/utils/format';

type Tone = 'immersive' | 'panel';

const QueueRow = memo(function QueueRow({ item, tone, sortable = true }: { item: QueueItem; tone: Tone; sortable?: boolean }) {
  const track = getTrack(item.trackId);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.uid, disabled: !sortable });
  if (!track) return null;
  const muted = tone === 'immersive' ? 'text-white/60' : 'text-muted';
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group flex items-center gap-3 rounded-xl px-2 py-1.5',
        tone === 'immersive' ? 'hover:bg-white/10' : 'hover:bg-fg/[0.05]',
        isDragging && (tone === 'immersive' ? 'z-10 bg-white/15 shadow-2xl' : 'z-10 bg-elevated shadow-2xl'),
      )}
    >
      {sortable && (
        <button
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${track.title}. Press space to pick up, arrow keys to move.`}
          className={cn('grid h-8 w-6 shrink-0 cursor-grab touch-none place-items-center rounded active:cursor-grabbing', muted)}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      <button onClick={() => player.jumpTo(item.uid)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Play ${track.title} now`}>
        <span className="relative shrink-0">
          <CoverImage src={trackCover(track)} alt="" rounded="rounded-md" className="h-10 w-10" />
          <span className="absolute inset-0 grid place-items-center rounded-md bg-black/50 opacity-0 transition group-hover:opacity-100">
            <Play className="h-4 w-4 text-white" fill="currentColor" />
          </span>
        </span>
        <span className="min-w-0">
          <span className={cn('block truncate text-sm font-semibold', tone === 'immersive' && 'text-white')}>{track.title}</span>
          <span className={cn('block truncate text-xs', muted)}>
            {artistNameOf(track)}
            {item.manual && ' · Queued'}
          </span>
        </span>
      </button>
      <span className={cn('text-xs tabular-nums', muted)}>{formatTime(track.duration)}</span>
      <button
        onClick={() => player.removeFromQueue(item.uid)}
        aria-label={`Remove ${track.title} from queue`}
        className={cn('grid h-8 w-8 place-items-center rounded-full opacity-0 transition focus-visible:opacity-100 group-hover:opacity-100', muted, 'hover:bg-white/10')}
      >
        <X className="h-4 w-4" />
      </button>
    </li>
  );
});

export function QueuePanel({ tone = 'panel', className }: { tone?: Tone; className?: string }) {
  const { queue, index } = usePlayer((s) => ({ queue: s.queue, index: s.index }), shallowEqual);
  const context = usePlayer((s) => s.context);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const history = usePlayer((s) => s.sessionHistory);
  const current = queue[index];
  const upNext = queue.slice(index + 1);
  const currentTrack = current ? getTrack(current.trackId) : undefined;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = queue.findIndex((q) => q.uid === active.id);
    const to = queue.findIndex((q) => q.uid === over.id);
    player.moveInQueue(from, to);
  };

  const heading = cn('mb-2 px-2 text-xs font-bold uppercase tracking-[0.14em]', tone === 'immersive' ? 'text-white/55' : 'text-subtle');
  const muted = tone === 'immersive' ? 'text-white/60' : 'text-muted';

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-6">
        <h3 className={heading}>Now playing</h3>
        {currentTrack ? (
          <div className={cn('mb-6 flex items-center gap-3 rounded-xl px-2 py-2', tone === 'immersive' ? 'bg-white/10' : 'bg-primary/[0.08]')}>
            <CoverImage src={trackCover(currentTrack)} alt="" rounded="rounded-md" className="h-12 w-12 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className={cn('truncate font-bold', tone === 'immersive' ? 'text-white' : 'text-primary')}>{currentTrack.title}</p>
              <p className={cn('truncate text-xs', muted)}>{artistNameOf(currentTrack)}</p>
            </div>
            <Equalizer playing={isPlaying} />
          </div>
        ) : (
          <p className={cn('mb-6 px-2 text-sm', muted)}>Nothing is playing.</p>
        )}

        <div className="mb-2 flex items-center justify-between px-2">
          <h3 className={cn(heading, 'mb-0 px-0')}>
            Up next
            {context && (
              <span className="ml-2 normal-case tracking-normal">
                · from{' '}
                {context.href ? (
                  <Link to={context.href} className="underline-offset-2 hover:underline">
                    {context.name}
                  </Link>
                ) : (
                  context.name
                )}
              </span>
            )}
          </h3>
          {upNext.length > 0 && (
            <button onClick={() => player.clearUpNext()} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold', muted, 'hover:bg-white/10')}>
              <ListX className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>
        {upNext.length === 0 ? (
          <p className={cn('px-2 py-4 text-sm', muted)}>Your queue is empty. Use “Play next” or “Add to queue” from any song’s menu.</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis]}>
            <SortableContext items={upNext.map((q) => q.uid)} strategy={verticalListSortingStrategy}>
              <ol className="space-y-0.5" aria-label="Up next" data-sortable-list>
                {upNext.map((item) => (
                  <QueueRow key={item.uid} item={item} tone={tone} />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}

        {history.length > 1 && (
          <>
            <h3 className={cn(heading, 'mt-6')}>Played this session</h3>
            <ul className="space-y-1 px-2">
              {[...history]
                .reverse()
                .slice(1, 8)
                .map((id, i) => {
                  const t = getTrack(id);
                  return t ? (
                    <li key={`${id}-${i}`} className={cn('flex justify-between gap-3 text-sm', muted)}>
                      <span className="truncate">
                        {t.title} · {artistNameOf(t)}
                      </span>
                      <button className="shrink-0 font-semibold hover:underline" onClick={() => player.playNext([id])}>
                        Play next
                      </button>
                    </li>
                  ) : null;
                })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
