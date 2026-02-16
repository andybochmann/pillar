import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShareTaskForm } from "./share-task-form";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}));

vi.mock("@/lib/offline-fetch", () => ({
  offlineFetch: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockProjects = [
  {
    _id: "proj-1",
    name: "Test Project",
    description: "",
    categoryId: "cat-1",
    userId: "user-1",
    columns: [
      { id: "todo", name: "To Do", order: 0 },
      { id: "in-progress", name: "In Progress", order: 1 },
    ],
    viewType: "board" as const,
    archived: false,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  },
  {
    _id: "proj-2",
    name: "Archived Project",
    description: "",
    categoryId: "cat-1",
    userId: "user-1",
    columns: [{ id: "todo", name: "To Do", order: 0 }],
    viewType: "board" as const,
    archived: true,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockProjects),
  });
});

async function waitForProjectsLoaded() {
  await waitFor(() => {
    expect((screen.getByLabelText("Project") as HTMLSelectElement).value).toBe("proj-1");
  });
}

describe("ShareTaskForm", () => {
  it("derives title from sharedTitle when provided", async () => {
    render(
      <ShareTaskForm sharedTitle="My Shared Title" sharedText="Some text" />,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("My Shared Title")).toBeInTheDocument();
    });
  });

  it("falls back to first line of sharedText when no sharedTitle", async () => {
    render(<ShareTaskForm sharedText={"First line\nSecond line"} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("First line")).toBeInTheDocument();
    });
    expect((screen.getByLabelText("Description") as HTMLTextAreaElement).value).toBe("Second line");
  });

  it("falls back to sharedUrl when no title or text", async () => {
    render(<ShareTaskForm sharedUrl="https://example.com" />);

    await waitFor(() => {
      expect(
        screen.getByDisplayValue("https://example.com"),
      ).toBeInTheDocument();
    });
  });

  it("builds description from remaining text and URL", async () => {
    render(
      <ShareTaskForm
        sharedTitle="Title"
        sharedText="Body text"
        sharedUrl="https://example.com"
      />,
    );

    await waitFor(() => {
      const desc = screen.getByLabelText("Description") as HTMLTextAreaElement;
      expect(desc.value).toBe("Body text\nhttps://example.com");
    });
  });

  it("builds description from text lines after first when no sharedTitle", async () => {
    render(
      <ShareTaskForm
        sharedText={"First line\nRest of text"}
        sharedUrl="https://example.com"
      />,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("First line")).toBeInTheDocument();
    });

    const desc = screen.getByLabelText("Description") as HTMLTextAreaElement;
    expect(desc.value).toBe("Rest of text\nhttps://example.com");
  });

  it("renders project selector with fetched projects (excluding archived)", async () => {
    render(<ShareTaskForm sharedTitle="Test" />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/projects");
    });

    await waitForProjectsLoaded();

    const select = screen.getByLabelText("Project") as HTMLSelectElement;
    const options = Array.from(select.options).filter((o) => !o.disabled);
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toBe("Test Project");
  });

  it("submits task with correct data via offlineFetch", async () => {
    const { offlineFetch } = await import("@/lib/offline-fetch");
    const mockedOfflineFetch = vi.mocked(offlineFetch);
    mockedOfflineFetch.mockResolvedValue(
      new Response(JSON.stringify({ _id: "task-1" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const user = userEvent.setup();
    render(
      <ShareTaskForm
        sharedTitle="Shared Task"
        sharedText="Description here"
      />,
    );

    await waitForProjectsLoaded();

    await user.click(screen.getByRole("button", { name: "Create Task" }));

    await waitFor(() => {
      expect(mockedOfflineFetch).toHaveBeenCalledWith("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Shared Task",
          description: "Description here",
          projectId: "proj-1",
          columnId: "todo",
          priority: "medium",
        }),
      });
    });
  });

  it("navigates to project page on successful submission", async () => {
    const { offlineFetch } = await import("@/lib/offline-fetch");
    const mockedOfflineFetch = vi.mocked(offlineFetch);
    mockedOfflineFetch.mockResolvedValue(
      new Response(JSON.stringify({ _id: "task-1" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { toast } = await import("sonner");

    const user = userEvent.setup();
    render(<ShareTaskForm sharedTitle="Test Task" />);

    await waitForProjectsLoaded();

    await user.click(screen.getByRole("button", { name: "Create Task" }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/projects/proj-1");
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Task created from shared content",
    );
  });

  it("navigates to / on cancel", async () => {
    const user = userEvent.setup();
    render(<ShareTaskForm sharedTitle="Test" />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mockPush).toHaveBeenCalledWith("/home");
  });

  it("disables submit when no title", async () => {
    render(<ShareTaskForm />);

    await waitForProjectsLoaded();

    expect(screen.getByRole("button", { name: "Create Task" })).toBeDisabled();
  });

  it("shows error toast on submission failure", async () => {
    const { offlineFetch } = await import("@/lib/offline-fetch");
    const mockedOfflineFetch = vi.mocked(offlineFetch);
    mockedOfflineFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: "Validation failed" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { toast } = await import("sonner");

    const user = userEvent.setup();
    render(<ShareTaskForm sharedTitle="Test Task" />);

    await waitForProjectsLoaded();

    await user.click(screen.getByRole("button", { name: "Create Task" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Validation failed");
    });
  });
});
