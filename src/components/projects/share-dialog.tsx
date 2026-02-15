"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserPlus, X, Crown, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useProjectMembers } from "@/hooks/use-project-members";
import { useUserSearch } from "@/hooks/use-user-search";
import { useBackButton } from "@/hooks/use-back-button";
import type { ProjectRole } from "@/types";

interface ShareDialogProps {
  projectId: string;
  projectName: string;
  currentUserRole: ProjectRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareDialog({
  projectId,
  projectName,
  currentUserRole,
  open,
  onOpenChange,
}: ShareDialogProps) {
  useBackButton("share-dialog", open, () => onOpenChange(false));

  const {
    members,
    loading: membersLoading,
    fetchMembers,
    addMember,
    updateMemberRole,
    removeMember,
  } = useProjectMembers(projectId);
  const { results, loading: searchLoading, search, clear } = useUserSearch();
  const [emailInput, setEmailInput] = useState("");

  useEffect(() => {
    if (open) {
      fetchMembers(projectId);
    }
  }, [open, projectId, fetchMembers]);

  function handleEmailChange(value: string) {
    setEmailInput(value);
    search(value);
  }

  async function handleAddMember(email: string) {
    try {
      await addMember(projectId, email);
      setEmailInput("");
      clear();
      toast.success("Member added");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleRoleChange(memberId: string, role: ProjectRole) {
    try {
      await updateMemberRole(projectId, memberId, role);
      toast.success("Role updated");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleRemoveMember(memberId: string, userName: string, isSelf: boolean) {
    try {
      await removeMember(projectId, memberId);
      toast.success(isSelf ? "You left the project" : `Removed ${userName}`);
      if (isSelf) {
        onOpenChange(false);
        window.location.href = "/";
      }
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const isOwner = currentUserRole === "owner";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Share &ldquo;{projectName}&rdquo;
          </DialogTitle>
          <DialogDescription className="sr-only">Manage project members and sharing</DialogDescription>
        </DialogHeader>

        {isOwner && (
          <div className="space-y-2">
            <div className="relative">
              <Input
                placeholder="Add by email..."
                value={emailInput}
                onChange={(e) => handleEmailChange(e.target.value)}
                aria-label="Search users by email"
              />
              {searchLoading && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>

            {results.length > 0 && (
              <div className="rounded-md border bg-popover p-1">
                {results.map((user) => {
                  const alreadyMember = members.some(
                    (m) => m.userId === user._id,
                  );
                  return (
                    <button
                      key={user._id}
                      type="button"
                      disabled={alreadyMember}
                      className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
                      onClick={() => handleAddMember(user.email)}
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {user.email}
                        </p>
                      </div>
                      {alreadyMember ? (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          Member
                        </Badge>
                      ) : (
                        <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <Separator />

        <ScrollArea className="max-h-64">
          <div className="space-y-1 pr-3">
            {membersLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              members.map((member) => (
                <div
                  key={member._id}
                  className="group flex items-center justify-between rounded-md px-2 py-2 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
                      {(member.userName ?? "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {member.userName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {member.userEmail}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {member.role === "owner" ? (
                      <Badge
                        variant="secondary"
                        className="gap-1 text-xs"
                      >
                        <Crown className="h-3 w-3" />
                        Owner
                      </Badge>
                    ) : isOwner ? (
                      <Select
                        value={member.role}
                        onValueChange={(value) =>
                          handleRoleChange(member._id, value as ProjectRole)
                        }
                      >
                        <SelectTrigger
                          className="h-7 w-24 text-xs"
                          aria-label={`Role for ${member.userName}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        {member.role === "editor" ? "Editor" : "Viewer"}
                      </Badge>
                    )}
                    {member.role !== "owner" && (
                      <Button
                        variant="ghost"
                        size={isOwner ? "icon" : "sm"}
                        className={isOwner ? "h-7 w-7" : "h-7 text-xs"}
                        onClick={() => handleRemoveMember(member._id, member.userName ?? "member", !isOwner)}
                        aria-label={isOwner ? `Remove ${member.userName}` : "Leave project"}
                      >
                        {isOwner ? <X className="h-3.5 w-3.5" /> : "Leave"}
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
