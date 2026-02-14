"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Auth error:", error);
  }, [error]);

  return (
    <div className="text-center space-y-4">
      <h2 className="text-2xl font-bold">Authentication Error</h2>
      <p className="text-muted-foreground">
        {error.message || "Something went wrong during authentication."}
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
