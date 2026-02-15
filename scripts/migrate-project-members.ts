import mongoose from "mongoose";
import { Project } from "../src/models/project";
import { ProjectMember } from "../src/models/project-member";

const DEFAULT_URI = "mongodb://localhost:27017/pillar";

export async function migrateProjectMembers(
  uri?: string,
): Promise<{ processed: number; created: number; skipped: number }> {
  const alreadyConnected = mongoose.connection.readyState === 1;

  if (!alreadyConnected) {
    const connectionUri = uri ?? process.env.MONGODB_URI ?? DEFAULT_URI;
    await mongoose.connect(connectionUri, { bufferCommands: false });
  }

  const projects = await Project.find({}, { _id: 1, userId: 1 }).lean();

  let created = 0;
  let skipped = 0;

  for (const project of projects) {
    const exists = await ProjectMember.exists({
      projectId: project._id,
      userId: project.userId,
    });

    if (exists) {
      skipped++;
      continue;
    }

    await ProjectMember.create({
      projectId: project._id,
      userId: project.userId,
      role: "owner",
      invitedBy: project.userId,
    });
    created++;
  }

  const result = { processed: projects.length, created, skipped };

  console.log("Migration complete:");
  console.log(`  Projects processed: ${result.processed}`);
  console.log(`  Members created:    ${result.created}`);
  console.log(`  Skipped (existing): ${result.skipped}`);

  return result;
}

// Run directly when executed as a script (not imported for tests)
const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].includes("migrate-project-members") ||
    process.argv[1].endsWith("tsx"));

if (isDirectRun && !process.env.VITEST) {
  migrateProjectMembers()
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
