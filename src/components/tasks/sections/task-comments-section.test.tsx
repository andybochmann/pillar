import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskCommentsSection } from "./task-comments-section";
import type { Comment, ProjectMember } from "@/types";

const addComment = vi.fn();
const deleteComment = vi.fn();
const fetchComments = vi.fn();
let mockComments: Comment[] = [];

vi.mock("@/hooks/use-comments", () => ({
  useComments: () => ({
    comments: mockComments,
    loading: false,
    error: null,
    fetchComments,
    addComment,
    deleteComment,
  }),
}));

const members: ProjectMember[] = [
  {
    _id: "m1",
    projectId: "proj1",
    userId: "owner1",
    role: "owner",
    invitedBy: "owner1",
    userName: "Olivia Owner",
    userEmail: "olivia@example.com",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    _id: "m2",
    projectId: "proj1",
    userId: "editor1",
    role: "editor",
    invitedBy: "owner1",
    userName: "Eddie Editor",
    userEmail: "eddie@example.com",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

function comment(overrides: Partial<Comment> = {}): Comment {
  return {
    _id: "c1",
    taskId: "task1",
    projectId: "proj1",
    userId: "editor1",
    body: "Hello team",
    mentions: [],
    authorName: "Eddie Editor",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("TaskCommentsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockComments = [];
  });

  it("renders the Comments header collapsed by default", () => {
    render(<TaskCommentsSection taskId="task1" members={members} />);
    expect(screen.getByText("Comments")).toBeInTheDocument();
    // Composer hidden until expanded
    expect(
      screen.queryByLabelText("Add a comment"),
    ).not.toBeInTheDocument();
  });

  it("expands to reveal the composer and empty state", async () => {
    const user = userEvent.setup();
    render(<TaskCommentsSection taskId="task1" members={members} />);
    await user.click(screen.getByText("Comments"));
    expect(screen.getByLabelText("Add a comment")).toBeInTheDocument();
    expect(screen.getByText(/No comments yet/i)).toBeInTheDocument();
  });

  it("renders existing comments with author and body when expanded", async () => {
    mockComments = [comment()];
    const user = userEvent.setup();
    render(<TaskCommentsSection taskId="task1" members={members} />);
    await user.click(screen.getByText(/Comments/));
    expect(screen.getByText("Eddie Editor")).toBeInTheDocument();
    expect(screen.getByText("Hello team")).toBeInTheDocument();
  });

  it("submits a comment and extracts mentions from the body", async () => {
    addComment.mockResolvedValue(comment());
    const user = userEvent.setup();
    render(
      <TaskCommentsSection
        taskId="task1"
        members={members}
        currentUserId="editor1"
      />,
    );
    await user.click(screen.getByText("Comments"));

    const textarea = screen.getByLabelText("Add a comment");
    await user.type(textarea, "ping @Olivia Owner please");
    await user.click(screen.getByRole("button", { name: "Post comment" }));

    await waitFor(() => expect(addComment).toHaveBeenCalledTimes(1));
    expect(addComment).toHaveBeenCalledWith({
      body: "ping @Olivia Owner please",
      mentions: ["owner1"],
    });
  });

  it("disables the post button when the composer is empty", async () => {
    const user = userEvent.setup();
    render(<TaskCommentsSection taskId="task1" members={members} />);
    await user.click(screen.getByText("Comments"));
    expect(screen.getByRole("button", { name: "Post comment" })).toBeDisabled();
  });

  it("shows a delete control on the current user's own comment", async () => {
    mockComments = [comment({ userId: "editor1" })];
    const user = userEvent.setup();
    render(
      <TaskCommentsSection
        taskId="task1"
        members={members}
        currentUserId="editor1"
      />,
    );
    await user.click(screen.getByText(/Comments/));
    const del = screen.getByLabelText("Delete comment by Eddie Editor");
    await user.click(del);
    expect(deleteComment).toHaveBeenCalledWith("c1");
  });

  it("hides the delete control on other users' comments for non-owners", async () => {
    mockComments = [comment({ _id: "c2", userId: "someone-else", authorName: "Someone Else" })];
    const user = userEvent.setup();
    render(
      <TaskCommentsSection
        taskId="task1"
        members={members}
        currentUserId="editor1"
      />,
    );
    await user.click(screen.getByText(/Comments/));
    expect(
      screen.queryByLabelText("Delete comment by Someone Else"),
    ).not.toBeInTheDocument();
  });

  it("lets a project owner delete any comment", async () => {
    mockComments = [comment({ _id: "c3", userId: "editor1", authorName: "Eddie Editor" })];
    const user = userEvent.setup();
    render(
      <TaskCommentsSection
        taskId="task1"
        members={members}
        currentUserId="owner1"
      />,
    );
    await user.click(screen.getByText(/Comments/));
    expect(
      screen.getByLabelText("Delete comment by Eddie Editor"),
    ).toBeInTheDocument();
  });
});
