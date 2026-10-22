import * as React from "react";

export type WorkspaceTab = "overview" | "specs" | "mappings" | "execute" | "report";

export interface ProjectSidebarProps {
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  specCount?: number;
  mappingCount?: number;
  hasPlan?: boolean;
}

export function ProjectSidebar({
  activeTab,
  onTabChange,
  specCount = 0,
  mappingCount = 0,
  hasPlan = false,
}: ProjectSidebarProps) {
  const tabs: Array<{ id: WorkspaceTab; label: string; badge?: string | number }> = [
    { id: "overview", label: "Overview" },
    { id: "specs", label: "Specs & Diff", badge: specCount > 0 ? `${specCount} specs` : undefined },
    { id: "mappings", label: "Mapping Review", badge: mappingCount > 0 ? mappingCount : undefined },
    { id: "execute", label: "Test & Adapter", badge: hasPlan ? "Plan ready" : undefined },
    { id: "report", label: "Report" },
  ];

  return (
    <aside className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-slate-200 bg-white p-3 flex md:flex-col justify-start space-x-1 md:space-x-0 md:space-y-1 overflow-x-auto">
      <div className="hidden md:block px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        Workspace Navigation
      </div>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition text-left whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
              isActive
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
            }`}
          >
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`ml-2 text-[10px] px-1.5 py-0.2 rounded font-mono ${
                  isActive ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-600 border border-slate-200"
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </aside>
  );
}
