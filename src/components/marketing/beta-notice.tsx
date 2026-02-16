import { Construction } from "lucide-react";

export function BetaNotice() {
  return (
    <section className="py-6 sm:py-8">
      <div className="mx-auto max-w-4xl px-6">
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-5 sm:p-6 dark:border-amber-700 dark:bg-amber-950/30">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-200 dark:bg-amber-900">
              <Construction className="h-5 w-5 text-amber-700 dark:text-amber-300" />
            </div>
            <div className="space-y-2 text-sm leading-relaxed text-amber-900 dark:text-amber-200">
              <p className="text-base font-semibold">
                Beta Software &mdash; Active Development
              </p>
              <p>
                Pillar is currently in beta and under active development. It is
                provided free of charge, but this may change in the future. The
                app is intended for personal use and is offered as-is with no
                guarantees.
              </p>
              <p>
                While we do our best to protect your data, code updates may
                occasionally result in data loss. We recommend not relying on
                Pillar as your sole system of record for critical information.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
