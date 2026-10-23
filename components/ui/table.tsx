import * as React from "react";

export function Table({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`w-full overflow-x-auto border border-slate-200 rounded-md bg-white shadow-xs ${className}`}>
      <table className="w-full text-left text-xs text-slate-800">{children}</table>
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
  return <thead className={`bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 ${className}`}>{children}</thead>;
}

export function TableBody({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <tbody className={`divide-y divide-slate-100 ${className}`}>{children}</tbody>;
}

export function TableRow({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <tr className={`hover:bg-slate-50/80 transition-colors ${className}`}>{children}</tr>;
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
  return <td className={`py-2.5 px-3 text-xs ${className}`}>{children}</td>;
}
