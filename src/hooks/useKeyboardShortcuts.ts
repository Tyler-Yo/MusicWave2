/**
 * Global keyboard shortcuts.
 *   Space play/pause · ←/→ seek 5 s (Shift: 15 s) · N / P next / previous
 *   Shift+↑/↓ volume · M mute · S shuffle · R repeat · L lyrics · K karaoke
 *   Q queue · [ / ] lyric offset −/+ 0.25 s · F like · Esc close · ? help
 */
import { useEffect } from 'react';
import { libraryActions } from '@/state/libraryStore';
import { currentTrackId, player, playerStore } from '@/state/playerStore';
import { OFFSET_STEP, settingsActions } from '@/state/settingsStore';
import { ui, uiStore } from '@/state/uiStore';

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return !['checkbox', 'radio', 'button', 'range'].includes(type);
  }
  return false;
}

/** Elements that already react to Space/arrows natively. */
function handlesKeyNatively(el: EventTarget | null, key: string): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (key === ' ' && (el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button')) return true;
  if ((key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown') && el instanceof HTMLInputElement && el.type === 'range') return true;
  return Boolean(el.closest('[role="listbox"], [role="menu"], [data-sortable-list]')) && key.startsWith('Arrow');
}

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      if (handlesKeyNatively(e.target, e.key)) return;
      const s = playerStore.get();
      const trackId = currentTrackId(s);
      let handled = true;
      switch (e.key) {
        case ' ':
          player.toggle();
          break;
        case 'ArrowRight':
          player.seekBy(e.shiftKey ? 15 : 5);
          break;
        case 'ArrowLeft':
          player.seekBy(e.shiftKey ? -15 : -5);
          break;
        case 'ArrowUp':
          if (!e.shiftKey) {
            handled = false;
            break;
          }
          player.setVolume(s.volume + 0.05);
          break;
        case 'ArrowDown':
          if (!e.shiftKey) {
            handled = false;
            break;
          }
          player.setVolume(s.volume - 0.05);
          break;
        case 'n':
        case 'N':
          player.next();
          break;
        case 'p':
        case 'P':
          player.previous();
          break;
        case 'm':
        case 'M':
          player.toggleMute();
          break;
        case 's':
        case 'S':
          player.toggleShuffle();
          break;
        case 'r':
        case 'R':
          player.cycleRepeat();
          break;
        case 'l':
        case 'L': {
          const u = uiStore.get();
          if (u.nowPlayingOpen && u.nowPlayingPanel === 'lyrics') ui.closeNowPlaying();
          else ui.openNowPlaying('lyrics');
          break;
        }
        case 'k':
        case 'K':
          settingsActions.toggleKaraoke();
          break;
        case 'q':
        case 'Q': {
          const u = uiStore.get();
          if (u.nowPlayingOpen) ui.togglePanel('queue');
          else ui.toggleQueueDrawer();
          break;
        }
        case '[':
          if (trackId) settingsActions.nudgeOffset(trackId, -OFFSET_STEP);
          break;
        case ']':
          if (trackId) settingsActions.nudgeOffset(trackId, OFFSET_STEP);
          break;
        case 'f':
        case 'F':
          if (trackId) libraryActions.toggleLike(trackId);
          break;
        case 'Escape': {
          const u = uiStore.get();
          if (u.shortcutsOpen) ui.setShortcutsOpen(false);
          else if (u.queueDrawerOpen) ui.toggleQueueDrawer(false);
          else if (u.nowPlayingOpen) ui.closeNowPlaying();
          else handled = false;
          break;
        }
        case '?':
          ui.setShortcutsOpen(!uiStore.get().shortcutsOpen);
          break;
        default:
          handled = false;
      }
      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export const SHORTCUTS: Array<[string, string]> = [
  ['Space', 'Play / pause'],
  ['← / →', 'Seek 5 seconds (Shift: 15 s)'],
  ['N / P', 'Next / previous track'],
  ['Shift + ↑ / ↓', 'Volume up / down'],
  ['M', 'Mute'],
  ['S', 'Shuffle'],
  ['R', 'Repeat (off → all → one)'],
  ['L', 'Open / close lyrics'],
  ['K', 'Karaoke mode'],
  ['Q', 'Queue'],
  ['[ / ]', 'Lyrics offset −/+ 0.25 s'],
  ['F', 'Like current song'],
  ['Esc', 'Close player / dialogs'],
  ['?', 'Show shortcuts'],
];
