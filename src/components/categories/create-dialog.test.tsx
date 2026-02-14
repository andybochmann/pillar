import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateCategoryDialog } from "./create-dialog";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("CreateCategoryDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onCreate: vi.fn().mockResolvedValue({}),
  };

  it("renders the dialog with form fields", () => {
    render(<CreateCategoryDialog {...defaultProps} />);
    expect(screen.getByText("Create Category")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(
      screen.getByRole("radiogroup", { name: "Category color" }),
    ).toBeInTheDocument();
  });

  it("disables submit when name is empty", () => {
    render(<CreateCategoryDialog {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
  });

  it("enables submit when name is entered", async () => {
    const user = userEvent.setup();
    render(<CreateCategoryDialog {...defaultProps} />);

    await user.type(screen.getByLabelText("Name"), "Work");
    expect(screen.getByRole("button", { name: "Create" })).toBeEnabled();
  });

  it("calls onCreate with name and color on submit", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue({});
    render(<CreateCategoryDialog {...defaultProps} onCreate={onCreate} />);

    await user.type(screen.getByLabelText("Name"), "Work");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(onCreate).toHaveBeenCalledWith({
      name: "Work",
      color: "#6366f1",
    });
  });

  it("allows selecting a different color", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue({});
    render(<CreateCategoryDialog {...defaultProps} onCreate={onCreate} />);

    await user.click(screen.getByRole("radio", { name: "#22c55e" }));
    await user.type(screen.getByLabelText("Name"), "Health");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(onCreate).toHaveBeenCalledWith({
      name: "Health",
      color: "#22c55e",
    });
  });

  it("closes dialog on cancel", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <CreateCategoryDialog {...defaultProps} onOpenChange={onOpenChange} />,
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes dialog after successful creation", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <CreateCategoryDialog
        {...defaultProps}
        onOpenChange={onOpenChange}
        onCreate={vi.fn().mockResolvedValue({})}
      />,
    );

    await user.type(screen.getByLabelText("Name"), "Work");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not render when closed", () => {
    render(<CreateCategoryDialog {...defaultProps} open={false} />);
    expect(screen.queryByText("Create Category")).not.toBeInTheDocument();
  });
});
