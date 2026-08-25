import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useIsFetching } from '@tanstack/react-query';
import AppSidebar from './AppSidebar';
import PageLoader from '@/components/ui/PageLoader';
import NotificationBell from '@/components/ui/NotificationBell';

function usePageLoader() {
  const isFetching = useIsFetching();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!isFetching) { setShow(false); return; }
    const t = setTimeout(() => setShow(true), 150);
    return () => clearTimeout(t);
  }, [isFetching]);
  return show;
}

export default function Layout() {
  const loading = usePageLoader();
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <header className="shrink-0 flex items-center justify-end gap-2 px-4 py-2 border-b border-gray-200 bg-white/80 backdrop-blur-sm z-20">
          <NotificationBell />
        </header>
        <main className="flex-1 p-6 overflow-auto min-w-0 relative">
          {loading && <PageLoader />}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
