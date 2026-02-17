import Link from "next/link";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-primary/[0.04] via-background to-background pb-12 pt-20 sm:pb-16 sm:pt-28">
      {/* Decorative background gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/[0.10] via-transparent to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-primary/[0.05] via-transparent to-transparent" />

      {/* Content */}
      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <div className="mb-6 inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
          Task Management, Simplified
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          Organize your work with{" "}
          <span className="text-primary">Pillar</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          A simple, powerful Kanban task manager. Drag-and-drop boards, team
          collaboration, offline support, and real-time sync &mdash; all in one
          app.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="px-8">
            <Link href="/register">Get Started</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="px-8">
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      </div>

      {/* Screenshot */}
      <div className="relative mx-auto mt-12 max-w-5xl px-6 sm:mt-16">
        <div className="overflow-hidden rounded-xl border border-border/50 shadow-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/kanban-board.png"
            alt="Pillar kanban board showing tasks organized across To Do, In Progress, Review, and Done columns"
            width={1440}
            height={900}
            className="w-full"
          />
        </div>
      </div>
    </section>
  );
}
