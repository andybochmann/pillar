import { auth } from "@/lib/auth";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MarketingFooter } from "@/components/marketing/marketing-footer";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const isAuthenticated = !!session?.user;

  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader isAuthenticated={isAuthenticated} />
      <main className="flex-1">{children}</main>
      <MarketingFooter isAuthenticated={isAuthenticated} />
    </div>
  );
}
