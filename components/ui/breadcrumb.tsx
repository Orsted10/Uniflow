import * as React from "react";
import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className = "" }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={`flex items-center text-xs text-zinc-400 ${className}`}>
      <ol className="flex items-center space-x-1.5 flex-wrap">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className="flex items-center space-x-1.5">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="hover:text-zinc-100 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 rounded px-1"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={item.current || isLast ? "font-medium text-zinc-200" : "text-zinc-400"}
                  aria-current={item.current || isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
              {!isLast && <span className="text-zinc-600 select-none">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
