import Link from "next/link";
import { FolderKanban } from "lucide-react";

interface MarketingFooterProps {
  isAuthenticated: boolean;
}

export function MarketingFooter({ isAuthenticated }: MarketingFooterProps) {
  return (
    <footer className="border-t bg-muted/40">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-8 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
            <FolderKanban className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="text-sm text-muted-foreground">
            Pillar &copy; {new Date().getFullYear()}
          </span>
        </div>

        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms of Service
          </Link>
          {isAuthenticated ? (
            <Link href="/home" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>
          ) : (
            <Link href="/login" className="hover:text-foreground transition-colors">
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </footer>
  );
}
