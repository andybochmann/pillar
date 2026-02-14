"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface Category {
  _id: string;
  name: string;
  color: string;
}

interface Project {
  _id: string;
  name: string;
  categoryId: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const [categories, setCategories] = useState<Category[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [catRes, projRes] = await Promise.all([
          fetch("/api/categories"),
          fetch("/api/projects"),
        ]);
        if (catRes.ok) setCategories(await catRes.json());
        if (projRes.ok) setProjects(await projRes.json());
      } catch {
        // Silently fail — sidebar will show empty state
      }
    }
    loadData();
  }, [pathname]);

  const projectsByCategory = categories.map((cat) => ({
    ...cat,
    projects: projects.filter((p) => p.categoryId === cat._id),
  }));

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r bg-card transition-all duration-200",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        {!collapsed && (
          <Link href="/" className="text-lg font-bold">
            Pillar
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="h-8 w-8"
        >
          {collapsed ? "→" : "←"}
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <nav className="p-3 space-y-1">
          {!collapsed && (
            <>
              <Link
                href="/"
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
                  pathname === "/" && "bg-accent",
                )}
              >
                Dashboard
              </Link>
              <Link
                href="/overview"
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
                  pathname === "/overview" && "bg-accent",
                )}
              >
                Overview
              </Link>
              <Link
                href="/calendar"
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
                  pathname === "/calendar" && "bg-accent",
                )}
              >
                Calendar
              </Link>

              <Separator className="my-3" />

              {/* Categories & Projects */}
              {projectsByCategory.map((cat) => (
                <div key={cat._id} className="space-y-1">
                  <div className="flex items-center gap-2 px-3 py-1">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {cat.name}
                    </span>
                  </div>
                  {cat.projects.map((project) => (
                    <Link
                      key={project._id}
                      href={`/projects/${project._id}`}
                      className={cn(
                        "flex items-center rounded-md px-3 py-2 pl-7 text-sm transition-colors hover:bg-accent",
                        pathname === `/projects/${project._id}` &&
                          "bg-accent font-medium",
                      )}
                    >
                      {project.name}
                    </Link>
                  ))}
                </div>
              ))}

              {categories.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  No categories yet. Create one to get started.
                </p>
              )}
            </>
          )}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t p-3">
        {!collapsed && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            Sign out
          </Button>
        )}
      </div>
    </aside>
  );
}
