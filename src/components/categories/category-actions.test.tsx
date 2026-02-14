import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryActions } from "./category-actions";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("CategoryActions", () => {
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
    category,
    onAddProject: vi.fn(),
    onUpdate: vi.fn().mockResolvedValue({}),
    onDelete: vi.fn().mockResolvedValue(undefined),
  };

  it("renders the trigger button", () => {
    render(<CategoryActions {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: `Actions for ${category.name}` }),
    ).toBeInTheDocument();
  });

  it("shows menu items when clicked", async () => {
    const user = userEvent.setup();
    render(<CategoryActions {...defaultProps} />);

    await user.click(
      screen.getByRole("button", { name: `Actions for ${category.name}` }),
    );

    expect(screen.getByRole("menuitem", { name: /add project/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /delete/i })).toBeInTheDocument();
  });

  it("calls onAddProject when Add Project is clicked", async () => {
    const user = userEvent.setup();
    const onAddProject = vi.fn();
    render(<CategoryActions {...defaultProps} onAddProject={onAddProject} />);

    await user.click(
      screen.getByRole("button", { name: `Actions for ${category.name}` }),
    );
    await user.click(screen.getByRole("menuitem", { name: /add project/i }));

    expect(onAddProject).toHaveBeenCalledWith("cat-1");
  });

  it("opens edit dialog when Edit is clicked", async () => {
    const user = userEvent.setup();
    render(<CategoryActions {...defaultProps} />);

    await user.click(
      screen.getByRole("button", { name: `Actions for ${category.name}` }),
    );
    await user.click(screen.getByRole("menuitem", { name: /edit/i }));

    expect(screen.getByText("Edit Category")).toBeInTheDocument();
  });

  it("shows delete confirmation when Delete is clicked", async () => {
    const user = userEvent.setup();
    render(<CategoryActions {...defaultProps} />);

    await user.click(
      screen.getByRole("button", { name: `Actions for ${category.name}` }),
    );
    await user.click(screen.getByRole("menuitem", { name: /delete/i }));

    expect(screen.getByText(/delete category/i)).toBeInTheDocument();
    expect(screen.getByText(/all projects and tasks/i)).toBeInTheDocument();
  });

  it("calls onDelete when delete is confirmed", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<CategoryActions {...defaultProps} onDelete={onDelete} />);

    await user.click(
      screen.getByRole("button", { name: `Actions for ${category.name}` }),
    );
    await user.click(screen.getByRole("menuitem", { name: /delete/i }));
    await user.click(screen.getByRole("button", { name: /delete/i }));

    expect(onDelete).toHaveBeenCalledWith("cat-1");
  });
});
