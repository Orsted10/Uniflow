"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Project } from "@/lib/supabase/models";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  projects?: Project[];
  onLaunchCanonical?: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  projects = [],
  onLaunchCanonical,
}: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  React.useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const commands = React.useMemo(
    () => [
      {
        id: "launch-canonical",
        label: "Create & Open Canonical Billing v1 → Invoice v2 Project",
        hint: "Quick Start",
        run: () => {
          onClose();
          if (onLaunchCanonical) onLaunchCanonical();
          else router.push("/projects/new");
        },
      },
      {
        id: "new-project",
        label: "Create New Compatibility Workspace",
        hint: "/projects/new",
        run: () => {
          onClose();
          router.push("/projects/new");
        },
      },
      {
        id: "browse-projects",
        label: "Browse All Workspaces",
        hint: "/projects",
        run: () => {
          onClose();
          router.push("/projects");
        },
      },
      {
        id: "login",
        label: "Authentication & Developer Session",
        hint: "/login",
        run: () => {
          onClose();
          router.push("/login");
        },
      },
      ...projects.map((p) => ({
        id: `proj-${p.id}`,
        label: `Open Workspace: ${p.name}`,
        hint: p.id,
        run: () => {
          onClose();
          router.push(`/projects/${p.id}`);
        },
      })),
    ],
    [onClose, onLaunchCanonical, projects, router]
  );

  const filtered = React.useMemo(
    () =>
      commands.filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          c.hint.toLowerCase().includes(query.toLowerCase())
      ),
    [commands, query]
  );

  React.useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (filtered.length > 0 ? (prev + 1) % filtered.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        filtered.length > 0 ? (prev - 1 + filtered.length) % filtered.length : 0
      );
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      filtered[selectedIndex].run();
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={onClose}
      className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-start justify-center pt-[16vh] px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="apple-glass rounded-2xl max-w-lg w-full overflow-hidden"
      >
        <div className="px-4 py-3 border-b border-white/[0.08] flex items-center gap-3">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            className="text-zinc-400 shrink-0"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
            <path d="M20 20L16.5 16.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Jump to workspace, compile, or navigate..."
            className="w-full bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none"
          />
          <kbd className="text-[10px] font-mono text-zinc-400 bg-white/[0.06] border border-white/[0.08] px-1.5 py-0.5 rounded">
            ESC
          </kbd>
        </div>

        <div className="max-h-72 overflow-y-auto p-2 space-y-0.5">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">No matching commands.</div>
          ) : (
            filtered.map((cmd, idx) => (
              <button
                key={cmd.id}
                type="button"
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={cmd.run}
                className={`w-full px-3 py-2.5 rounded-xl flex items-center justify-between text-left transition text-xs ${
                  idx === selectedIndex
                    ? "bg-[#f3e7d3]/15 text-white border border-[#f3e7d3]/25"
                    : "text-zinc-300 hover:bg-white/[0.05] border border-transparent"
                }`}
              >
                <span className="font-medium truncate pr-3">{cmd.label}</span>
                <span className="font-mono text-[10px] text-zinc-400 shrink-0">{cmd.hint}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
