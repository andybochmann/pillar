import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TimeReportView } from "@/components/reports/time-report-view";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return <TimeReportView />;
}
