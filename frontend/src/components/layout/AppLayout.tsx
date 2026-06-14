import { ReactNode } from 'react';
import { useUIStore } from '../../store/uiStore';
import Sidebar from './Sidebar';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { sidebarOpen } = useUIStore();

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-gray-50 touch-manipulation dark:bg-gray-950">
      <Sidebar />
      <main
        className={`flex-1 transition-all md:ml-0 ${
          sidebarOpen ? 'ml-72' : 'ml-0'
        }`}
      >
        {children}
      </main>
    </div>
  );
}
