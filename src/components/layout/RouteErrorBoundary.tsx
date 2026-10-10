/**
 * Catches errors while loading or rendering a page (e.g. a code chunk that can't be
 * fetched offline) so the player and navigation keep working.
 */
import { Component, type ReactNode } from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';

interface State {
  error: Error | null;
}

export class RouteErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const chunk = /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(error.message);
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center" role="alert">
        <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-fg/[0.06] text-muted">
          <CloudOff className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-bold">{chunk ? 'This page couldn’t be loaded' : 'Something went wrong on this page'}</h2>
        <p className="mt-2 text-sm text-muted">
          {chunk && offline
            ? 'You’re offline and this part of the app isn’t saved on this device yet. Your downloads still play.'
            : chunk
              ? 'A newer version of MusicWave may be available.'
              : error.message}
        </p>
        <button
          onClick={() => (chunk ? window.location.reload() : this.setState({ error: null }))}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-fg/10 px-4 py-2 text-sm font-semibold hover:bg-fg/15"
        >
          <RefreshCw className="h-4 w-4" /> {chunk ? 'Reload' : 'Try again'}
        </button>
      </div>
    );
  }
}
