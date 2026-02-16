import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CtaSection() {
  return (
    <section className="relative overflow-hidden border-t py-16 sm:py-20">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-background to-primary/[0.03]" />
      <div className="relative mx-auto max-w-5xl px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight">
          Ready to get organized?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Create a free account and start managing your tasks in minutes.
        </p>
        <div className="mt-8">
          <Button asChild size="lg" className="px-8">
            <Link href="/register">Create Free Account</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
