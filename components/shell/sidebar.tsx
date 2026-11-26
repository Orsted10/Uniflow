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
    <aside className="w-full md:w-64 shrink-0 apple-glass p-3.5 flex md:flex-col justify-start gap-1.5 overflow-x-auto rounded-3xl h-fit">
      <div className="hidden md:block px-3.5 py-2 text-xs font-mono uppercase tracking-wider text-zinc-400">
        Pipeline Stages
      </div>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center justify-between px-4 py-2.5 rounded-2xl text-[14px] font-medium transition-all duration-150 text-left whitespace-nowrap focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30 ${
              isActive
                ? "bg-[#f3e7d3] text-[#141210] font-semibold shadow-sm"
                : "text-zinc-300 hover:text-white hover:bg-white/[0.06]"
            }`}
          >
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`ml-2 text-xs px-2.5 py-0.5 rounded-full font-mono ${
                  isActive
                    ? "bg-[#141210]/15 text-[#141210] font-semibold"
                    : "bg-white/[0.06] text-zinc-300 border border-white/[0.1]"
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
