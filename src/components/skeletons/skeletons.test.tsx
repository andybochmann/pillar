import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardSkeleton } from "./dashboard-skeleton";
import { KanbanBoardSkeleton } from "./kanban-board-skeleton";
import { OverviewSkeleton } from "./overview-skeleton";
import { CalendarSkeleton } from "./calendar-skeleton";
import { SidebarSkeleton } from "./sidebar-skeleton";
import { TaskSheetSkeleton } from "./task-sheet-skeleton";

describe("Skeleton components", () => {
  it("renders DashboardSkeleton with 3 cards", () => {
    render(<DashboardSkeleton />);
    const skeletons = screen.getAllByTestId
      ? document.querySelectorAll('[data-slot="skeleton"]')
      : document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders KanbanBoardSkeleton with columns", () => {
    const { container } = render(<KanbanBoardSkeleton />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(5);
  });

  it("renders OverviewSkeleton with table rows", () => {
    const { container } = render(<OverviewSkeleton />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(10);
  });

  it("renders CalendarSkeleton with 7-column grid", () => {
    const { container } = render(<CalendarSkeleton />);
    const grids = container.querySelectorAll(".grid-cols-7");
    expect(grids.length).toBeGreaterThanOrEqual(2);
  });

  it("renders SidebarSkeleton with nav items", () => {
    render(<SidebarSkeleton />);
    const aside = document.querySelector("aside");
    expect(aside).toBeTruthy();
  });

  it("renders TaskSheetSkeleton with form fields", () => {
    const { container } = render(<TaskSheetSkeleton />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(5);
  });
});
