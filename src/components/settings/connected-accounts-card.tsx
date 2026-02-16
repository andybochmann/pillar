"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ConnectedAccountsCardProps {
  providers: string[];
}

const providerDisplayNames: Record<string, string> = {
  credentials: "Email & Password",
  google: "Google",
};

const oauthProviders = ["google"] as const;

export function ConnectedAccountsCard({ providers }: ConnectedAccountsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected Accounts</CardTitle>
        <CardDescription>
          Manage your linked sign-in methods
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {providers.includes("credentials") && (
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium">Email &amp; Password</span>
            </div>
            <span className="text-xs text-muted-foreground">Connected</span>
          </div>
        )}
        {oauthProviders.map((providerId) => {
          const isConnected = providers.includes(providerId);
          return (
            <div
              key={providerId}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-500" : "bg-muted-foreground/30"}`}
                />
                <span className="text-sm font-medium">
                  {providerDisplayNames[providerId]}
                </span>
              </div>
              {isConnected ? (
                <span className="text-xs text-muted-foreground">Connected</span>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => signIn(providerId, { callbackUrl: "/settings" })}
                >
                  Connect
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
