import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GenerateSubtasksDialog } from "./generate-subtasks-dialog";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function mockFetchResponse(data: unknown, ok = true) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(data),
  });
}

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  taskTitle: "Build login page",
  taskDescription: "OAuth-based login",
  taskPriority: "high",
  existingSubtasks: [] as string[],
  maxSubtasks: 50,
  onSubtasksAdded: vi.fn(),
};

describe("GenerateSubtasksDialog", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  it("renders initial state with count selector and context input", () => {
    render(<GenerateSubtasksDialog {...defaultProps} />);

    expect(screen.getByText("Generate Subtasks")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Describe any specific requirements/),
    ).toBeInTheDocument();
  });

  it("changes count when a count button is clicked", async () => {
    const user = userEvent.setup();
    render(<GenerateSubtasksDialog {...defaultProps} />);

    await user.click(screen.getByText("3"));
    expect(screen.getByText("Generate 3 Subtasks")).toBeInTheDocument();
  });

  it("caps count options by remaining slots", () => {
    render(
      <GenerateSubtasksDialog
        {...defaultProps}
        existingSubtasks={Array(45).fill("step")}
        maxSubtasks={50}
      />,
    );

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.queryByText("8")).not.toBeInTheDocument();
    expect(screen.queryByText("10")).not.toBeInTheDocument();
  });

  it("shows loading state during generation", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: () => Promise.resolve({ subtasks: [] }),
              }),
            100,
          );
        }),
    );

    render(<GenerateSubtasksDialog {...defaultProps} />);

    await user.click(screen.getByText(/Generate \d+ Subtasks/));
    expect(screen.getByText("Generating subtasks...")).toBeInTheDocument();
  });

  it("shows drafts after generation", async () => {
    const user = userEvent.setup();
    mockFetchResponse({
      subtasks: ["Write tests", "Implement feature"],
    });

    render(<GenerateSubtasksDialog {...defaultProps} />);

    await user.click(screen.getByText(/Generate \d+ Subtasks/));

    expect(screen.getByText("2 of 2 selected")).toBeInTheDocument();
    expect(screen.getByText("Add 2 Subtasks")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Write tests")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Implement feature")).toBeInTheDocument();
  });

  it("updates selected count when toggling", async () => {
    const user = userEvent.setup();
    mockFetchResponse({
      subtasks: ["Step 1", "Step 2"],
    });

    render(<GenerateSubtasksDialog {...defaultProps} />);

    await user.click(screen.getByText(/Generate \d+ Subtasks/));

    await user.click(screen.getByLabelText("Select Step 1"));

    expect(screen.getByText("1 of 2 selected")).toBeInTheDocument();
    expect(screen.getByText("Add 1 Subtask")).toBeInTheDocument();
  });

  it("shows select/deselect all toggle", async () => {
    const user = userEvent.setup();
    mockFetchResponse({
      subtasks: ["Step 1"],
    });

    render(<GenerateSubtasksDialog {...defaultProps} />);

    await user.click(screen.getByText(/Generate \d+ Subtasks/));

    expect(screen.getByText("Deselect All")).toBeInTheDocument();

    await user.click(screen.getByText("Deselect All"));

    expect(screen.getByText("Select All")).toBeInTheDocument();
    expect(screen.getByText("0 of 1 selected")).toBeInTheDocument();
  });

  it("calls onSubtasksAdded with selected titles on Add", async () => {
    const user = userEvent.setup();
    const onSubtasksAdded = vi.fn();
    mockFetchResponse({
      subtasks: ["Step 1", "Step 2", "Step 3"],
    });

    render(
      <GenerateSubtasksDialog
        {...defaultProps}
        onSubtasksAdded={onSubtasksAdded}
      />,
    );

    await user.click(screen.getByText(/Generate \d+ Subtasks/));

    // Deselect Step 2
    await user.click(screen.getByLabelText("Select Step 2"));

    await user.click(screen.getByText("Add 2 Subtasks"));

    expect(onSubtasksAdded).toHaveBeenCalledWith(["Step 1", "Step 3"]);
  });

  it("has DialogDescription for accessibility", () => {
    render(<GenerateSubtasksDialog {...defaultProps} />);

    expect(
      screen.getByText(/Use AI to generate subtasks/),
    ).toBeInTheDocument();
  });

  it("passes context to API when generating", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ subtasks: ["Step 1"] }),
    });

    render(<GenerateSubtasksDialog {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(
      /Describe any specific requirements/,
    );
    await user.type(textarea, "Focus on security");

    await user.click(screen.getByText(/Generate \d+ Subtasks/));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/ai/generate-subtasks",
      expect.objectContaining({
        body: expect.stringContaining("Focus on security"),
      }),
    );
  });
});
