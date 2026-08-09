import { Outlet } from 'react-router-dom';
import TableList from './TableList';

export default function ToolkitLayout() {
  return (
    <div className="flex h-full -m-4 overflow-hidden">
      <TableList />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 pb-16">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
