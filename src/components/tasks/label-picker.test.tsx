import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LabelPicker, COLOR_PRESETS } from "./label-picker";
import type { Label } from "@/types";

const mockLabels: Label[] = [
  {
    _id: "lbl-1",
    name: "Bug",
    color: "#ef4444",
    userId: "u1",
    createdAt: "",
    updatedAt: "",
  },
  {
    _id: "lbl-2",
    name: "Feature",
    color: "#3b82f6",
    userId: "u1",
    createdAt: "",
    updatedAt: "",
  },
];

describe("LabelPicker", () => {
  let onToggle: ReturnType<typeof vi.fn>;
  let onCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onToggle = vi.fn();
    onCreate = vi.fn().mockResolvedValue(undefined);
  });

  it("renders selected labels as badges", () => {
    render(
      <LabelPicker
        labels={mockLabels}
        selectedLabels={["Bug"]}
        onToggle={onToggle}
        onCreate={onCreate}
      />,
    );

    expect(screen.getByText("Bug ×")).toBeInTheDocument();
  });

  it("removes label when badge is clicked", async () => {
    const user = userEvent.setup();
    render(
      <LabelPicker
        labels={mockLabels}
        selectedLabels={["Bug"]}
        onToggle={onToggle}
        onCreate={onCreate}
      />,
    );

    await user.click(screen.getByText("Bug ×"));
    expect(onToggle).toHaveBeenCalledWith("Bug");
  });

  it("shows manage labels button", () => {
    render(
      <LabelPicker
        labels={mockLabels}
        selectedLabels={[]}
        onToggle={onToggle}
        onCreate={onCreate}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Manage labels" }),
    ).toBeInTheDocument();
  });

  it("opens popover and shows label list with checkboxes", async () => {
    const user = userEvent.setup();
    render(
      <LabelPicker
        labels={mockLabels}
        selectedLabels={["Bug"]}
        onToggle={onToggle}
        onCreate={onCreate}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Manage labels" }));

    expect(screen.getByLabelText("Toggle Bug")).toBeInTheDocument();
    expect(screen.getByLabelText("Toggle Feature")).toBeInTheDocument();
  });

  it("toggles label when checkbox is clicked", async () => {
    const user = userEvent.setup();
    render(
      <LabelPicker
        labels={mockLabels}
        selectedLabels={[]}
        onToggle={onToggle}
        onCreate={onCreate}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Manage labels" }));
    await user.click(screen.getByLabelText("Toggle Feature"));

    expect(onToggle).toHaveBeenCalledWith("Feature");
  });

  it("shows empty state when no labels exist", async () => {
    const user = userEvent.setup();
    render(
      <LabelPicker
        labels={[]}
        selectedLabels={[]}
        onToggle={onToggle}
        onCreate={onCreate}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Manage labels" }));

    expect(screen.getByText("No labels yet")).toBeInTheDocument();
  });

  it("shows create label form in popover", async () => {
    const user = userEvent.setup();
    render(
      <LabelPicker
        labels={mockLabels}
        selectedLabels={[]}
        onToggle={onToggle}
        onCreate={onCreate}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Manage labels" }));

    expect(screen.getByLabelText("New label name")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create label" }),
    ).toBeInTheDocument();
    // Color presets
    expect(screen.getAllByRole("radio")).toHaveLength(COLOR_PRESETS.length);
  });

  it("creates a new label", async () => {
    const user = userEvent.setup();
    render(
      <LabelPicker
        labels={mockLabels}
        selectedLabels={[]}
        onToggle={onToggle}
        onCreate={onCreate}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Manage labels" }));
    await user.type(screen.getByLabelText("New label name"), "Urgent");
    await user.click(screen.getByRole("button", { name: "Create label" }));

    expect(onCreate).toHaveBeenCalledWith({ name: "Urgent", color: "#ef4444" });
  });

  it("creates label on Enter key", async () => {
    const user = userEvent.setup();
    render(
      <LabelPicker
        labels={mockLabels}
        selectedLabels={[]}
        onToggle={onToggle}
        onCreate={onCreate}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Manage labels" }));
    await user.type(screen.getByLabelText("New label name"), "Urgent{Enter}");

    expect(onCreate).toHaveBeenCalledWith({ name: "Urgent", color: "#ef4444" });
  });

  it("disables create button when name is empty", async () => {
    const user = userEvent.setup();
    render(
      <LabelPicker
        labels={mockLabels}
        selectedLabels={[]}
        onToggle={onToggle}
        onCreate={onCreate}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Manage labels" }));

    expect(screen.getByRole("button", { name: "Create label" })).toBeDisabled();
  });

  it("allows selecting a color preset", async () => {
    const user = userEvent.setup();
    render(
      <LabelPicker
        labels={mockLabels}
        selectedLabels={[]}
        onToggle={onToggle}
        onCreate={onCreate}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Manage labels" }));
    // Click the blue preset
    await user.click(screen.getByRole("radio", { name: "#3b82f6" }));
    await user.type(screen.getByLabelText("New label name"), "Blue");
    await user.click(screen.getByRole("button", { name: "Create label" }));

    expect(onCreate).toHaveBeenCalledWith({ name: "Blue", color: "#3b82f6" });
  });
});
