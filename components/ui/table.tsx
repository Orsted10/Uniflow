import * as React from "react";

export function Table({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`w-full overflow-x-auto border border-zinc-800 rounded-lg bg-zinc-900/50 ${className}`}>
      <table className="w-full text-left text-xs text-zinc-200">{children}</table>
    </div>
  );
}

export function TableHeader({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <thead className={`bg-zinc-950/80 text-zinc-400 font-medium border-b border-zinc-800 ${className}`}>{children}</thead>;
}

export function TableBody({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <tbody className={`divide-y divide-zinc-800/70 ${className}`}>{children}</tbody>;
}

export function TableRow({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <tr className={`hover:bg-zinc-800/40 transition-colors ${className}`}>{children}</tr>;
}

export function TableHead({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <th className={`py-2.5 px-3 uppercase tracking-wider text-[11px] font-semibold ${className}`}>{children}</th>;
}

export function TableCell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`py-2.5 px-3 align-middle ${className}`}>{children}</td>;
}
