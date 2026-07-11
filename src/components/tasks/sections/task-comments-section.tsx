"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, ChevronRight, MessageSquare, AtSign, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useComments } from "@/hooks/use-comments";
import { extractMentions, mentionToken } from "@/lib/mentions";
import { toast } from "sonner";
import type { Comment, ProjectMember } from "@/types";

interface TaskCommentsSectionProps {
  taskId: string;
  members?: ProjectMember[];
  currentUserId?: string;
}

function memberDisplayName(member: ProjectMember): string {
  return member.userName ?? member.userEmail ?? "Member";
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

// Defensive: an optimistic/offline comment may lack a valid timestamp.
function formatCommentTime(createdAt?: string): string {
  if (!createdAt) return "just now";
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime())
    ? "just now"
    : formatDistanceToNow(date, { addSuffix: true });
}

export function TaskCommentsSection({
  taskId,
  members = [],
  currentUserId,
}: TaskCommentsSectionProps) {
  const { comments, loading, fetchComments, addComment, deleteComment } =
    useComments(taskId);

  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (expanded) fetchComments();
  }, [expanded, fetchComments]);

  // Resolve the current user's role to decide whether they can delete others' comments
  const isOwner = useMemo(
    () => members.some((m) => m.userId === currentUserId && m.role === "owner"),
    [members, currentUserId],
  );

  const memberById = useMemo(() => {
    const map = new Map<string, ProjectMember>();
    for (const m of members) map.set(m.userId, m);
    return map;
  }, [members]);

  function authorLabel(comment: Comment): string {
    if (comment.authorName) return comment.authorName;
    const member = memberById.get(comment.userId);
    if (member) return memberDisplayName(member);
    // Offline-created comment (no author yet) — it's the current user's own.
    if (!comment.userId && currentUserId) {
      const self = memberById.get(currentUserId);
      if (self) return memberDisplayName(self);
    }
    return "Unknown";
  }

  function canDelete(comment: Comment): boolean {
    return comment.userId === currentUserId || isOwner;
  }

  function insertMention(member: ProjectMember) {
    const token = mentionToken(member);
    setBody((prev) => {
      const needsSpace = prev.length > 0 && !prev.endsWith(" ");
      return `${prev}${needsSpace ? " " : ""}${token} `;
    });
    textareaRef.current?.focus();
  }

  async function handleSubmit() {
    const trimmed = body.trim();
    if (!trimmed || submitting) return;
    const mentions = extractMentions(trimmed, members);
    setSubmitting(true);
    try {
      await addComment({ body: trimmed, mentions });
      setBody("");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to add comment",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteComment(id);
      toast.success("Comment deleted");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete comment",
      );
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Cmd/Ctrl+Enter submits
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2"
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <Label className="cursor-pointer">
          Comments
          {comments.length > 0 && (
            <span className="ml-1 text-muted-foreground">
              ({comments.length})
            </span>
          )}
        </Label>
      </button>

      {expanded && (
        <div className="space-y-3 pl-6">
          {loading ? (
            <p className="py-2 text-center text-xs text-muted-foreground">
              Loading…
            </p>
          ) : comments.length === 0 ? (
            <p className="py-2 text-xs text-muted-foreground">
              No comments yet. Start the discussion.
            </p>
          ) : (
            <ul className="space-y-3">
              {comments.map((comment) => {
                const name = authorLabel(comment);
                return (
                  <li key={comment._id} className="flex gap-2">
                    <Avatar size="sm" className="mt-0.5">
                      {comment.authorImage && (
                        <AvatarImage src={comment.authorImage} alt="" />
                      )}
                      <AvatarFallback>{initials(name) || "?"}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {name}
                        </span>
                        <time
                          className="shrink-0 text-xs text-muted-foreground"
                          dateTime={comment.createdAt}
                        >
                          {formatCommentTime(comment.createdAt)}
                        </time>
                        {canDelete(comment) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="ml-auto h-6 w-6 shrink-0 text-muted-foreground"
                            aria-label={`Delete comment by ${name}`}
                            onClick={() => handleDelete(comment._id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {comment.body}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="space-y-2">
            <Label htmlFor="new-comment" className="sr-only">
              Add a comment
            </Label>
            <Textarea
              id="new-comment"
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write a comment…"
              rows={3}
              aria-label="Add a comment"
            />
            <div className="flex items-center justify-between gap-2">
              {members.length > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      aria-label="Mention a member"
                    >
                      <AtSign className="h-3.5 w-3.5" />
                      Mention
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuLabel>Mention a member</DropdownMenuLabel>
                    {members.map((member) => (
                      <DropdownMenuItem
                        key={member.userId}
                        onSelect={() => insertMention(member)}
                      >
                        {memberDisplayName(member)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <span />
              )}
              <Button
                type="button"
                size="sm"
                onClick={handleSubmit}
                disabled={!body.trim() || submitting}
                aria-label="Post comment"
              >
                {submitting ? "Posting…" : "Comment"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
