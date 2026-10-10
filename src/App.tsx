import { lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { AppProviders } from '@/providers/AppProviders';
import { HomePage } from '@/pages/HomePage';

const SearchPage = lazy(() => import('@/pages/SearchPage'));
const GenrePage = lazy(() => import('@/pages/GenrePage'));
const AlbumPage = lazy(() => import('@/pages/AlbumPage'));
const ArtistPage = lazy(() => import('@/pages/ArtistPage'));
const PlaylistPage = lazy(() => import('@/pages/PlaylistPage'));
const MixPage = lazy(() => import('@/pages/MixPage'));
const ChartsPage = lazy(() => import('@/pages/ChartsPage'));
const NewReleasesPage = lazy(() => import('@/pages/NewReleasesPage'));
const LibraryPage = lazy(() => import('@/pages/LibraryPage'));
const CollectionPage = lazy(() => import('@/pages/CollectionPage'));
const DownloadsPage = lazy(() => import('@/pages/DownloadsPage'));
const BrowseGenrePage = lazy(() => import('@/pages/BrowseGenrePage'));
const LyricsStudioPage = lazy(() => import('@/pages/LyricsStudioPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

export function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppProviders>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="genre/:id" element={<GenrePage />} />
            <Route path="album/:id" element={<AlbumPage />} />
            <Route path="artist/:id" element={<ArtistPage />} />
            <Route path="playlist/:id" element={<PlaylistPage />} />
            <Route path="mix/:id" element={<MixPage />} />
            <Route path="charts" element={<ChartsPage />} />
            <Route path="new-releases" element={<NewReleasesPage />} />
            <Route path="library" element={<LibraryPage />} />
            <Route path="collection/:id" element={<CollectionPage />} />
            <Route path="downloads" element={<DownloadsPage />} />
            <Route path="browse/:genre" element={<BrowseGenrePage />} />
            <Route path="studio" element={<LyricsStudioPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AppProviders>
    </BrowserRouter>
  );
}
