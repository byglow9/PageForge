"use client";

/**
 * SidebarNav — workspace shell navigation links with active-route highlighting.
 *
 * Client component so it can read the current pathname and highlight the
 * section the user is currently in. Link visibility is gated by role
 * (resolved server-side and passed in as booleans).
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, LayoutDashboard, LayoutTemplate, Palette, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarNavProps {
  slug: string;
  canAuthorTemplates: boolean;
  canEditBrand: boolean;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

export function SidebarNav({
  slug,
  canAuthorTemplates,
  canEditBrand,
}: SidebarNavProps) {
  const pathname = usePathname();

  const items: NavItem[] = [
    { href: `/w/${slug}`, label: "Dashboard", icon: LayoutDashboard, exact: true },
    ...(canAuthorTemplates
      ? [
          {
            href: `/w/${slug}/templates`,
            label: "Templates",
            icon: LayoutTemplate,
          },
        ]
      : []),
    { href: `/w/${slug}/lps`, label: "Landing Pages", icon: FileText },
    ...(canEditBrand
      ? [{ href: `/w/${slug}/brand`, label: "Brand Settings", icon: Palette }]
      : []),
    { href: `/w/${slug}/members`, label: "Members", icon: Users },
  ];

  return (
    <nav className="flex-1 py-4">
      <ul className="space-y-1 px-2">
        {items.map(({ href, label, icon: Icon, exact }) => {
          const active = exact
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-gray-100 text-gray-900 font-medium"
                    : "text-gray-700 hover:bg-white hover:text-gray-900"
                )}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-gray-900"
                  />
                )}
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
