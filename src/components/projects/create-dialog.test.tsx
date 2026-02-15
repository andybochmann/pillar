import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateProjectDialog } from "./create-dialog";
import type { Category } from "@/types";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockCategories: Category[] = [
  {
    _id: "cat-1",
    name: "Work",
    color: "#6366f1",
    order: 0,
    userId: "u1",
    createdAt: "",
    updatedAt: "",
  },
  {
    _id: "cat-2",
    name: "Personal",
    color: "#22c55e",
    order: 1,
    userId: "u1",
    createdAt: "",
    updatedAt: "",
  },
];

describe("CreateProjectDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    categories: mockCategories,
    onCreate: vi.fn().mockResolvedValue({}),
  };

  it("renders the dialog with form fields", () => {
    render(<CreateProjectDialog {...defaultProps} />);
    expect(screen.getByText("Create Project")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
    expect(screen.getByText("Select a category")).toBeInTheDocument();
  });

  it("disables submit when name is empty", () => {
    render(<CreateProjectDialog {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
  });

  it("calls onCreate with correct data on submit", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue({});
    render(
      <CreateProjectDialog
        {...defaultProps}
        onCreate={onCreate}
        defaultCategoryId="cat-1"
      />,
    );

    await user.type(screen.getByLabelText("Name"), "My Project");
    await user.type(screen.getByLabelText("Description"), "A test project");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(onCreate).toHaveBeenCalledWith({
      name: "My Project",
      description: "A test project",
      categoryId: "cat-1",
      viewType: "board",
    });
  });

  it("closes dialog on cancel", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <CreateProjectDialog {...defaultProps} onOpenChange={onOpenChange} />,
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not render when closed", () => {
    render(<CreateProjectDialog {...defaultProps} open={false} />);
    expect(screen.queryByText("Create Project")).not.toBeInTheDocument();
  });

  it("uses defaultCategoryId when provided", () => {
    render(<CreateProjectDialog {...defaultProps} defaultCategoryId="cat-2" />);
    // The select should show the pre-selected category
    expect(screen.getAllByText("Personal").length).toBeGreaterThanOrEqual(1);
  });
});
