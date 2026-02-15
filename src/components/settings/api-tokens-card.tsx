"use client";

import { useState, useEffect } from "react";
import { Copy, Trash2, Plus, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useApiTokens } from "@/hooks/use-api-tokens";
import type { AccessToken } from "@/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export function ApiTokensCard() {
  const { tokens, fetchTokens, createToken, revokeToken } = useApiTokens();
  const [tokenName, setTokenName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  async function handleCreate() {
    if (!tokenName.trim()) return;
    setCreating(true);
    try {
      const raw = await createToken(tokenName.trim());
      setNewToken(raw);
      setTokenName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create token");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    try {
      await revokeToken(id);
      toast.success("Token revoked");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke token");
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  const mcpUrl = `${window.location.origin}/api/mcp`;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>API Tokens</CardTitle>
          <CardDescription>
            Personal access tokens for MCP — connect AI tools like Claude
            Desktop or Cursor to your Pillar account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* MCP Server URL */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium">MCP Server URL</p>
            <div className="flex items-center gap-2">
              <code className="bg-muted flex-1 rounded px-3 py-2 text-sm break-all">
                {mcpUrl}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCopy(mcpUrl)}
                aria-label="Copy MCP URL"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Create token */}
          <div className="flex gap-2">
            <Input
              placeholder="Token name (e.g. Claude Desktop)"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              maxLength={100}
            />
            <Button
              onClick={handleCreate}
              disabled={creating || !tokenName.trim()}
            >
              <Plus className="mr-1 h-4 w-4" />
              {creating ? "Creating..." : "Create token"}
            </Button>
          </div>

          {/* Token list */}
          {tokens.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 py-6 text-sm">
              <Key className="h-8 w-8 opacity-50" />
              <p>No API tokens yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tokens.map((token: AccessToken) => (
                <div
                  key={token._id}
                  className="bg-muted/50 flex items-center justify-between rounded-lg px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{token.name}</p>
                    <p className="text-muted-foreground text-xs">
                      <code>{token.tokenPrefix}...</code>
                      {" \u00b7 "}
                      Created {formatDate(token.createdAt)}
                      {token.lastUsedAt && (
                        <>
                          {" \u00b7 "}
                          Last used {formatDate(token.lastUsedAt)}
                        </>
                      )}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRevoke(token._id)}
                    aria-label={`Revoke ${token.name}`}
                  >
                    <Trash2 className="text-destructive h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* One-time token dialog */}
      <Dialog open={!!newToken} onOpenChange={() => setNewToken(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Token created</DialogTitle>
            <DialogDescription>
              Copy this token now. You won&apos;t be able to see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code
              className="bg-muted flex-1 rounded px-3 py-2 text-sm break-all"
              data-token-value={newToken ?? undefined}
            >
              {newToken}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleCopy(newToken!)}
              aria-label="Copy token"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => setNewToken(null)}>Done</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
