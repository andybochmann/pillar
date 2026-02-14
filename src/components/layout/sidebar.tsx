"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { CreateCategoryDialog } from "@/components/categories/create-dialog";
import { CreateProjectDialog } from "@/components/projects/create-dialog";
import { useCategories } from "@/hooks/use-categories";
import { useProjects } from "@/hooks/use-projects";

export function Sidebar() {
  const pathname = usePathname();
  const {
    categories,
    createCategory,
    refresh: refreshCategories,
  } = useCategories();
  const { projects, createProject, refresh: refreshProjects } = useProjects();
  const [collapsed, setCollapsed] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [projectDialogCategoryId, setProjectDialogCategoryId] = useState<
    string | undefined
  >();

  // Re-fetch when navigating
  useEffect(() => {
    refreshCategories();
    refreshProjects();
  }, [pathname, refreshCategories, refreshProjects]);

  const projectsByCategory = categories.map((cat) => ({
    ...cat,
    projects: projects.filter((p) => p.categoryId === cat._id),
  }));

  function handleOpenProjectDialog(categoryId?: string) {
    setProjectDialogCategoryId(categoryId);
    setShowProjectDialog(true);
  }

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
              <div className="flex items-center justify-between px-3 py-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Categories
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => setShowCategoryDialog(true)}
                  aria-label="Create category"
                >
                  +
                </Button>
              </div>

              {projectsByCategory.map((cat) => (
                <div key={cat._id} className="space-y-1">
                  <div className="flex items-center justify-between px-3 py-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {cat.name}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => handleOpenProjectDialog(cat._id)}
                      aria-label={`Add project to ${cat.name}`}
                    >
                      +
                    </Button>
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

      <CreateCategoryDialog
        open={showCategoryDialog}
        onOpenChange={setShowCategoryDialog}
        onCreate={createCategory}
      />

      <CreateProjectDialog
        key={projectDialogCategoryId ?? "no-cat"}
        open={showProjectDialog}
        onOpenChange={setShowProjectDialog}
        categories={categories}
        defaultCategoryId={projectDialogCategoryId}
        onCreate={createProject}
      />
    </aside>
  );
}
