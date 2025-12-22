"use client";

import Link from "next/link";
import {
  Home,
  Users,
  Building,
  Landmark,
  Cog,
  User,
  PanelLeft,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";

const navItems = [
  { href: "/dashboard", icon: Home, label: "Dashboard" },
  { href: "/miei-gruppi", icon: Users, label: "I Miei Gruppi" },
  { href: "/contabilita", icon: Landmark, label: "Contabilità" },
  { href: "/nucleo-familiare", icon: Building, label: "Nucleo Familiare" },
  { href: "/admin-panel", icon: Cog, label: "Admin Panel" },
];

export default function Sidebar() {
  const pathname = usePathname();

  const renderNavLinks = (isMobile = false) =>
    navItems.map((item) => {
      const isActive = pathname === item.href;
      const linkClasses = cn(
        "flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground",
        {
          "text-foreground bg-accent": isActive,
          "rounded-lg": !isMobile,
          "rounded-md": isMobile,
        }
      );

      if (isMobile) {
        return (
          <Link key={item.href} href={item.href} className={linkClasses}>
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        );
      }

      return (
        <TooltipProvider key={item.href}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={item.href}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8",
                  {
                    "bg-accent text-accent-foreground": isActive,
                  }
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="sr-only">{item.label}</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    });
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
        <nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
          <Link
            href="#"
            className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base"
          >
            <User className="h-4 w-4 transition-all group-hover:scale-110" />
            <span className="sr-only">AC Chiari</span>
          </Link>
          {renderNavLinks()}
        </nav>
        <nav className="mt-auto flex flex-col items-center gap-4 px-2 sm:py-5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="#"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8"
                >
                  <Cog className="h-5 w-5" />
                  <span className="sr-only">Settings</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Settings</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </nav>
      </aside>
      <div className="sm:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button size="icon" variant="outline" className="sm:hidden">
              <PanelLeft className="h-5 w-5" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="sm:max-w-xs">
            <nav className="grid gap-6 text-lg font-medium">
              <Link
                href="#"
                className="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:text-base"
              >
                <User className="h-5 w-5 transition-all group-hover:scale-110" />
                <span className="sr-only">AC Chiari</span>
              </Link>
              {renderNavLinks(true)}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
