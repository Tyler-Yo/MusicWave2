/** Download state for a track: progress ring while downloading, check when saved. */
import { AlertCircle, ArrowDownCircle } from 'lucide-react';
import { useDownloadJob } from '@/hooks/useDownloadJob';
import { cn } from '@/utils/cn';

export function ProgressRing({ value, className }: { value: number | null; className?: string }) {
  const r = 7;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 18 18" className={cn('h-4 w-4 -rotate-90', value === null && 'animate-spin', className)} aria-hidden="true">
      <circle cx="9" cy="9" r={r} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <circle
        cx="9"
        cy="9"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={value === null ? c * 0.7 : c * (1 - value)}
      />
    </svg>
  );
}

export function DownloadIndicator({ trackId, downloaded }: { trackId: string; downloaded: boolean }) {
  const job = useDownloadJob(trackId);
  if (job) {
    if (job.status === 'error') return <AlertCircle className="h-3.5 w-3.5 shrink-0 text-ember" aria-label={`Download failed: ${job.error ?? ''}`} />;
    const value = job.status === 'queued' ? 0 : job.total ? job.received / job.total : null;
    return (
      <span className="shrink-0 text-primary" role="img" aria-label={job.status === 'queued' ? 'Waiting to download' : `Downloading${value !== null ? ` ${Math.round(value * 100)}%` : ''}`}>
        <ProgressRing value={value} className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (downloaded) return <ArrowDownCircle className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Downloaded" />;
  return null;
}
