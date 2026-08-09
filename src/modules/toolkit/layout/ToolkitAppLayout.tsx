import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useIsFetching } from '@tanstack/react-query';
import AppSidebar from '@/components/layout/AppSidebar';
import PageLoader from '@/components/ui/PageLoader';


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

export default function ToolkitAppLayout() {
  const loading = usePageLoader();
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <AppSidebar />
      <main className="flex-1 h-full p-4 overflow-auto min-w-0 relative">
        {loading && <PageLoader />}
        <Outlet />
      </main>
    </div>
  );
}
