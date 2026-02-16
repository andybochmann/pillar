import mongoose from "mongoose";
import { User } from "../src/models/user";
import { Account } from "../src/models/account";

const DEFAULT_URI = "mongodb://localhost:27017/pillar";

export async function migrateAccounts(
  uri?: string,
): Promise<{ processed: number; created: number; skipped: number }> {
  const alreadyConnected = mongoose.connection.readyState === 1;

  if (!alreadyConnected) {
    const connectionUri = uri ?? process.env.MONGODB_URI ?? DEFAULT_URI;
    await mongoose.connect(connectionUri, { bufferCommands: false });
  }

  const users = await User.find(
    { passwordHash: { $exists: true, $ne: null } },
    { _id: 1 },
  ).lean();

  let created = 0;
  let skipped = 0;

  for (const user of users) {
    const exists = await Account.exists({
      userId: user._id,
      provider: "credentials",
    });

    if (exists) {
      skipped++;
      continue;
    }

    await Account.create({
      userId: user._id,
      provider: "credentials",
      providerAccountId: user._id.toString(),
    });
    created++;
  }

  const result = { processed: users.length, created, skipped };

  console.log("Migration complete:");
  console.log(`  Users processed:    ${result.processed}`);
  console.log(`  Accounts created:   ${result.created}`);
  console.log(`  Skipped (existing): ${result.skipped}`);

  return result;
}

// Run directly when executed as a script (not imported for tests)
const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].includes("migrate-accounts") ||
    process.argv[1].endsWith("tsx"));

if (isDirectRun && !process.env.VITEST) {
  migrateAccounts()
    .then(async () => {
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("Migration failed:", err);
      await mongoose.disconnect();
      process.exit(1);
    });
}
