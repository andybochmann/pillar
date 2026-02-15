"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  ListTodo,
  CalendarDays,
  Settings,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  LogOut,
  FolderKanban,
} from "lucide-react";
import { CategoryActions } from "@/components/categories/category-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn, getViewIcon } from "@/lib/utils";
import { CreateCategoryDialog } from "@/components/categories/create-dialog";
import { CreateProjectDialog } from "@/components/projects/create-dialog";
import { useCategories } from "@/hooks/use-categories";
import { useProjects } from "@/hooks/use-projects";
import { useTaskCounts } from "@/hooks/use-task-counts";

interface SidebarProps {
  onNavigate?: () => void;
}

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/overview", label: "Overview", icon: ListTodo },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const {
    categories,
    createCategory,
    updateCategory,
    deleteCategory,
    refresh: refreshCategories,
  } = useCategories();
  const { projects, createProject, refresh: refreshProjects } = useProjects();
  const { counts, refresh: refreshCounts } = useTaskCounts();
  const [collapsed, setCollapsed] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [projectDialogCategoryId, setProjectDialogCategoryId] = useState<
    string | undefined
  >();
  const [showArchived, setShowArchived] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set(),
  );

  // Re-fetch when navigating or archive toggle changes
  useEffect(() => {
    refreshCategories();
    refreshProjects(showArchived);
    refreshCounts();
  }, [pathname, refreshCategories, refreshProjects, refreshCounts, showArchived]);

  const ownedProjects = projects.filter(
    (p) => !p.currentUserRole || p.currentUserRole === "owner",
  );
  const sharedProjects = projects.filter(
    (p) => p.currentUserRole && p.currentUserRole !== "owner",
  );

  const projectsByCategory = categories.map((cat) => ({
    ...cat,
    projects: ownedProjects.filter((p) => p.categoryId === cat._id),
  }));

  function handleOpenProjectDialog(categoryId?: string) {
    setProjectDialogCategoryId(categoryId);
    setShowProjectDialog(true);
  }

  function toggleCategory(catId: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r bg-sidebar transition-all duration-200",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <FolderKanban className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">Pillar</span>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="min-h-0 flex-1">
        <nav className="p-3 space-y-1">
          {!collapsed ? (
            <>
              {navItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary border-l-2 border-primary -ml-[2px] pl-[calc(0.75rem+2px)]"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}

              <button
                type="button"
                onClick={() =>
                  document.dispatchEvent(
                    new KeyboardEvent("keydown", { key: "/" }),
                  )
                }
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Search className="h-4 w-4 shrink-0" />
                Search…
                <kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                  /
                </kbd>
              </button>

              <Separator className="my-3" />

              {/* Categories & Projects */}
              <div className="flex items-center justify-between px-3 py-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Categories
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowCategoryDialog(true)}
                  aria-label="Create category"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              {projectsByCategory.map((cat) => {
                const isCatCollapsed = collapsedCategories.has(cat._id);
                return (
                  <div key={cat._id} className="space-y-0.5">
                    <div className="group flex items-center justify-between rounded-md px-3 py-1 hover:bg-accent/50 transition-colors">
                      <button
                        type="button"
                        onClick={() => toggleCategory(cat._id)}
                        className="flex items-center gap-2 min-w-0"
                      >
                        {isCatCollapsed ? (
                          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                        )}
                        <div
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
                          {cat.name}
                        </span>
                      </button>
                      {counts?.byCategory[cat._id] ? (
                        <Badge
                          variant="secondary"
                          className="ml-auto mr-1 h-5 min-w-5 px-1.5 text-[10px]"
                        >
                          {counts.byCategory[cat._id]}
                        </Badge>
                      ) : null}
                      <CategoryActions
                        category={cat}
                        onAddProject={handleOpenProjectDialog}
                        onUpdate={updateCategory}
                        onDelete={async (id) => {
                          await deleteCategory(id);
                          refreshProjects(showArchived);
                        }}
                      />
                    </div>
                    {!isCatCollapsed &&
                      cat.projects.map((project) => {
                        const ViewIcon = getViewIcon(project.viewType ?? "board");
                        return (
                          <Link
                            key={project._id}
                            href={`/projects/${project._id}`}
                            onClick={onNavigate}
                            className={cn(
                              "flex items-center gap-1.5 rounded-md px-3 py-1.5 pl-9 text-sm transition-colors",
                              pathname === `/projects/${project._id}`
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                              project.archived && "opacity-50",
                            )}
                          >
                            <ViewIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            {project.name}
                            {project.archived && (
                              <span className="ml-auto text-xs text-muted-foreground">
                                archived
                              </span>
                            )}
                          </Link>
                        );
                      })}
                  </div>
                );
              })}

              {categories.length === 0 && (
                <div className="px-3 py-6 text-center">
                  <FolderKanban className="mx-auto h-8 w-8 text-muted-foreground/40" />
                  <p className="mt-2 text-xs text-muted-foreground">
                    No categories yet.
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-1 h-auto p-0 text-xs"
                    onClick={() => setShowCategoryDialog(true)}
                  >
                    Create one to get started
                  </Button>
                </div>
              )}

              {/* Shared with me */}
              {sharedProjects.length > 0 && (
                <>
                  <Separator className="my-3" />
                  <div className="flex items-center px-3 py-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Shared with me
                    </span>
                  </div>
                  {sharedProjects.map((project) => {
                    const ViewIcon = getViewIcon(project.viewType ?? "board");
                    return (
                      <Link
                        key={project._id}
                        href={`/projects/${project._id}`}
                        onClick={onNavigate}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-3 py-1.5 pl-6 text-sm transition-colors",
                          pathname === `/projects/${project._id}`
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                          project.archived && "opacity-50",
                        )}
                      >
                        <ViewIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        {project.name}
                        {project.archived && (
                          <span className="ml-auto text-xs text-muted-foreground">
                            archived
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </>
              )}

              <Separator className="my-3" />

              <div className="flex items-center justify-between px-3 py-1">
                <span className="text-xs text-muted-foreground">
                  Show archived
                </span>
                <Switch
                  checked={showArchived}
                  onCheckedChange={setShowArchived}
                  aria-label="Show archived projects"
                  className="scale-75"
                />
              </div>
            </>
          ) : (
            /* Collapsed state — icon-only nav */
            <div className="flex flex-col items-center gap-1">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                    title={item.label}
                  >
                    <Icon className="h-4 w-4" />
                  </Link>
                );
              })}
            </div>
          )}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t p-3">
        {!collapsed ? (
          <Button
            variant="ghost"
            size="sm"
            className="w-full cursor-pointer justify-start gap-3 text-muted-foreground hover:text-foreground"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="mx-auto flex h-9 w-9 cursor-pointer text-muted-foreground hover:text-foreground"
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
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
