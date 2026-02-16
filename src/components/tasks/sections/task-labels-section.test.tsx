import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TaskLabelsSection } from "./task-labels-section";
import type { Label as LabelType } from "@/types";

const mockLabels: LabelType[] = [
  { _id: "label-1", name: "Bug", color: "#ef4444", userId: "user-1" },
  { _id: "label-2", name: "Feature", color: "#22c55e", userId: "user-1" },
  { _id: "label-3", name: "Enhancement", color: "#3b82f6", userId: "user-1" },
];

describe("TaskLabelsSection", () => {
  let onToggleLabel: ReturnType<typeof vi.fn>;
  let onCreateLabel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onToggleLabel = vi.fn();
    onCreateLabel = vi.fn();
  });

  it("renders Labels label", () => {
    render(
      <TaskLabelsSection
        allLabels={mockLabels}
        selectedLabels={[]}
        onToggleLabel={onToggleLabel}
        onCreateLabel={onCreateLabel}
      />,
    );

    expect(screen.getByText("Labels")).toBeInTheDocument();
  });

  it("renders LabelPicker with empty labels", () => {
    render(
      <TaskLabelsSection
        allLabels={[]}
        selectedLabels={[]}
        onToggleLabel={onToggleLabel}
        onCreateLabel={onCreateLabel}
      />,
    );

    expect(screen.getByText("Labels")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /manage labels/i })).toBeInTheDocument();
  });

  it("renders LabelPicker with labels provided", () => {
    render(
      <TaskLabelsSection
        allLabels={mockLabels}
        selectedLabels={[]}
        onToggleLabel={onToggleLabel}
        onCreateLabel={onCreateLabel}
      />,
    );

    expect(screen.getByRole("button", { name: /manage labels/i })).toBeInTheDocument();
  });

  it("renders with selected labels", () => {
    render(
      <TaskLabelsSection
        allLabels={mockLabels}
        selectedLabels={["label-1", "label-2"]}
        onToggleLabel={onToggleLabel}
        onCreateLabel={onCreateLabel}
      />,
    );

    // Selected labels are displayed as badges
    expect(screen.getByText(/Bug/)).toBeInTheDocument();
    expect(screen.getByText(/Feature/)).toBeInTheDocument();
  });

  it("renders without allLabels prop (undefined)", () => {
    render(
      <TaskLabelsSection
        selectedLabels={[]}
        onToggleLabel={onToggleLabel}
        onCreateLabel={onCreateLabel}
      />,
    );

    expect(screen.getByText("Labels")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /manage labels/i })).toBeInTheDocument();
  });

  it("renders without onCreateLabel prop (undefined)", () => {
    render(
      <TaskLabelsSection
        allLabels={mockLabels}
        selectedLabels={[]}
        onToggleLabel={onToggleLabel}
      />,
    );

    expect(screen.getByText("Labels")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /manage labels/i })).toBeInTheDocument();
  });

  it("renders with all selected labels", () => {
    render(
      <TaskLabelsSection
        allLabels={mockLabels}
        selectedLabels={["label-1", "label-2", "label-3"]}
        onToggleLabel={onToggleLabel}
        onCreateLabel={onCreateLabel}
      />,
    );

    expect(screen.getByText(/Bug/)).toBeInTheDocument();
    expect(screen.getByText(/Feature/)).toBeInTheDocument();
    expect(screen.getByText(/Enhancement/)).toBeInTheDocument();
  });

  it("renders with single selected label", () => {
    render(
      <TaskLabelsSection
        allLabels={mockLabels}
        selectedLabels={["label-2"]}
        onToggleLabel={onToggleLabel}
        onCreateLabel={onCreateLabel}
      />,
    );

    expect(screen.getByText(/Feature/)).toBeInTheDocument();
    expect(screen.queryByText(/Bug/)).not.toBeInTheDocument();
  });

  it("renders with space-y-1.5 layout class", () => {
    const { container } = render(
      <TaskLabelsSection
        allLabels={mockLabels}
        selectedLabels={[]}
        onToggleLabel={onToggleLabel}
        onCreateLabel={onCreateLabel}
      />,
    );

    const section = container.querySelector(".space-y-1\\.5");
    expect(section).toBeInTheDocument();
  });

  it("renders with large number of labels", () => {
    const manyLabels: LabelType[] = Array.from({ length: 20 }, (_, i) => ({
      _id: `label-${i}`,
      name: `Label ${i}`,
      color: "#ef4444",
      userId: "user-1",
    }));

    render(
      <TaskLabelsSection
        allLabels={manyLabels}
        selectedLabels={[]}
        onToggleLabel={onToggleLabel}
        onCreateLabel={onCreateLabel}
      />,
    );

    expect(screen.getByText("Labels")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /manage labels/i })).toBeInTheDocument();
  });
});
