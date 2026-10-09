import { Link } from 'react-router-dom';
import { Waves } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';

export default function NotFoundPage() {
  return (
    <EmptyState
      icon={<Waves className="h-7 w-7" />}
      title="This page drifted out to sea"
      action={
        <Link to="/" className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-bold text-on-primary">
          Back to Home
        </Link>
      }
    >
      The link may be broken or the page may have moved.
    </EmptyState>
  );
}
