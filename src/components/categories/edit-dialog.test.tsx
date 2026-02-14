import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditCategoryDialog } from "./edit-dialog";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("EditCategoryDialog", () => {
  const category = {
    _id: "cat-1",
    name: "Work",
    color: "#6366f1",
    userId: "user-1",
    order: 0,
    createdAt: "2024-01-01",
    updatedAt: "2024-01-01",
  };

  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    category,
    onSave: vi.fn().mockResolvedValue({}),
  };

  it("renders with current category name and color", () => {
    render(<EditCategoryDialog {...defaultProps} />);
    expect(screen.getByText("Edit Category")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Work");
    expect(screen.getByRole("radio", { name: "#6366f1" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("disables save when name is empty", async () => {
    const user = userEvent.setup();
    render(<EditCategoryDialog {...defaultProps} />);

    await user.clear(screen.getByLabelText("Name"));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("calls onSave with updated name and color", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue({});
    render(<EditCategoryDialog {...defaultProps} onSave={onSave} />);

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Personal");
    await user.click(screen.getByRole("radio", { name: "#22c55e" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith("cat-1", {
      name: "Personal",
      color: "#22c55e",
    });
  });

  it("closes dialog on cancel", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <EditCategoryDialog {...defaultProps} onOpenChange={onOpenChange} />,
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes dialog after successful save", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <EditCategoryDialog {...defaultProps} onOpenChange={onOpenChange} />,
    );

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not render when closed", () => {
    render(<EditCategoryDialog {...defaultProps} open={false} />);
    expect(screen.queryByText("Edit Category")).not.toBeInTheDocument();
  });
});
