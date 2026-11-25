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
    { id: "specs", label: "Specs & Diff", badge: specCount > 0 ? `${specCount}/2` : undefined },
    { id: "mappings", label: "Mapping Review", badge: mappingCount > 0 ? mappingCount : undefined },
    { id: "execute", label: "Test & Adapter", badge: hasPlan ? "Ready" : undefined },
    { id: "report", label: "Report & Cloud" },
  ];

  return (
    <aside className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-white/[0.07] bg-white/[0.02] p-2.5 flex md:flex-col justify-start gap-1 overflow-x-auto rounded-2xl">
      <div className="hidden md:block px-3 py-1.5 text-[11px] font-medium text-zinc-500">
        Pipeline Stages
      </div>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 text-left whitespace-nowrap focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30 ${
              isActive
                ? "bg-white/[0.12] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]"
            }`}
          >
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`ml-2 text-[10px] px-2 py-0.5 rounded-full font-mono ${
                  isActive
                    ? "bg-white/15 text-white"
                    : "bg-white/[0.04] text-zinc-400 border border-white/[0.07]"
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
