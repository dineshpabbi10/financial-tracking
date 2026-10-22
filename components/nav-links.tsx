"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  CalendarClock,
  LayoutDashboard,
  Landmark,
  Link2,
  Target,
  Upload,
} from "lucide-react";

const items = [
  { href: "/", label: "Overview", short: "Home", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", short: "Activity", icon: ArrowLeftRight },
  {
    href: "/import",
    label: "Import",
    short: "Import",
    icon: Upload,
    hideOnMobile: true,
  },
  { href: "/recurring", label: "Recurring", short: "Bills", icon: CalendarClock },
  { href: "/budgets", label: "Budgets", short: "Budgets", icon: Target },
  { href: "/accounts", label: "Accounts", short: "Accounts", icon: Landmark },
  {
    href: "/connections",
    label: "Connections",
    short: "Banks",
    icon: Link2,
    hideOnMobile: true,
  },
];

export function NavLinks({ variant }: { variant: "sidebar" | "bottom" }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const visible =
    variant === "bottom"
      ? items.filter((item) => !("hideOnMobile" in item && item.hideOnMobile))
      : items;

  if (variant === "bottom") {
    return (
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label="Primary"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {visible.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors ${
                  active ? "text-forest" : "text-faint hover:text-ink"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <span
                  className={`flex size-8 items-center justify-center rounded-full transition-colors ${
                    active ? "bg-forest-soft" : ""
                  }`}
                >
                  <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
                </span>
                {item.short}
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <nav className="mt-10 space-y-1.5" aria-label="Primary">
      {visible.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-paper text-forest shadow-sm"
                : "text-paper/65 hover:bg-white/8 hover:text-paper"
            }`}
            aria-current={active ? "page" : undefined}
          >
            <Icon
              size={18}
              strokeWidth={active ? 2.2 : 1.8}
              className={active ? "text-forest" : "text-paper/50 group-hover:text-paper/80"}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
