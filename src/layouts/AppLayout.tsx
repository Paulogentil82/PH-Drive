import React from 'react';
import { Sidebar } from './Sidebar';
import { MobileNavigation } from './MobileNavigation';
import { NavigationTab } from '../types';

interface AppLayoutProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  children: React.ReactNode;
  criticalAlertCount: number;
}

export function AppLayout({ currentTab, onSelectTab, children, criticalAlertCount }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row">
      <Sidebar currentTab={currentTab} onSelectTab={onSelectTab} criticalAlertCount={criticalAlertCount} />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileNavigation currentTab={currentTab} onSelectTab={onSelectTab} />
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
