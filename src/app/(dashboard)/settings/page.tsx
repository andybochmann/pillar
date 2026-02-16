import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { User } from "@/models/user";
import { Account } from "@/models/account";
import { SettingsClient } from "@/components/settings/settings-client";
import { Separator } from "@/components/ui/separator";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await connectDB();

  const [user, accounts] = await Promise.all([
    User.findById(session.user.id)
      .select("name email image passwordHash createdAt")
      .lean(),
    Account.find({ userId: session.user.id }).select("provider").lean(),
  ]);

  if (!user) redirect("/login");

  const providers = accounts.map((a) => a.provider);

  const profile = {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    image: user.image,
    hasPassword: !!user.passwordHash,
    providers,
    createdAt: user.createdAt.toISOString(),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>
      <Separator />
      <SettingsClient profile={profile} />
    </div>
  );
}
