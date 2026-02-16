import { Columns3, Users, WifiOff, Radio } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features = [
  {
    title: "Kanban Boards",
    description: "Drag-and-drop task management with customizable columns and priorities.",
    icon: Columns3,
  },
  {
    title: "Team Collaboration",
    description: "Share projects with your team, assign tasks, and track progress together.",
    icon: Users,
  },
  {
    title: "Works Offline",
    description: "Full PWA support with an offline queue that syncs when you reconnect.",
    icon: WifiOff,
  },
  {
    title: "Real-time Sync",
    description: "Live updates across all your devices via server-sent events.",
    icon: Radio,
  },
];

export function FeaturesSection() {
  return (
    <section className="border-t bg-muted/20 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-center text-3xl font-bold tracking-tight">
          Everything you need to stay on track
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
          Built for individuals and teams who want a fast, focused way to manage
          work.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.title}
                className="border-border/50 bg-background transition-shadow hover:shadow-md"
              >
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
