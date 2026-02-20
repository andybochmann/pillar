/**
 * Playwright global setup — runs once before all E2E tests.
 * Cleans up accumulated E2E test categories for the test user
 * to prevent the sidebar from having too many items (which crashes the browser).
 */
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://localhost:27017/pillar";
const TEST_EMAIL = "test@pillar.dev";

// Matches all E2E test category naming conventions across all spec files
const E2E_CATEGORY_PATTERN = /^(E2E\s|Notes\s)/;

export default async function globalSetup() {
  try {
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db!;

    // Find the test user
    const user = await db.collection("users").findOne({ email: TEST_EMAIL });
    if (!user) return;

    const userId = user._id;

    // Find all E2E test categories
    const oldCategories = await db
      .collection("categories")
      .find({ userId, name: E2E_CATEGORY_PATTERN })
      .toArray();

    if (oldCategories.length === 0) {
      console.log("[global-setup] No E2E categories to clean up");
      return;
    }

    const categoryIds = oldCategories.map((c) => c._id);

    // Cascade delete: projects → tasks → notes → categories
    const projects = await db
      .collection("projects")
      .find({ categoryId: { $in: categoryIds } })
      .toArray();
    const projectIds = projects.map((p) => p._id);

    if (projectIds.length > 0) {
      const tasks = await db
        .collection("tasks")
        .find({ projectId: { $in: projectIds } })
        .toArray();
      const taskIds = tasks.map((t) => t._id);
      if (taskIds.length > 0) {
        await db.collection("notes").deleteMany({ taskId: { $in: taskIds } });
        await db.collection("tasks").deleteMany({ _id: { $in: taskIds } });
      }
      await db.collection("notes").deleteMany({ projectId: { $in: projectIds } });
      await db.collection("projectmembers").deleteMany({ projectId: { $in: projectIds } });
      await db.collection("projects").deleteMany({ _id: { $in: projectIds } });
    }

    await db.collection("notes").deleteMany({ categoryId: { $in: categoryIds } });
    await db.collection("categories").deleteMany({ _id: { $in: categoryIds } });

    console.log(
      `[global-setup] Cleaned up ${oldCategories.length} E2E categories (${projectIds.length} projects)`,
    );
  } catch (err) {
    console.warn("[global-setup] Category cleanup failed (non-fatal):", err);
  } finally {
    await mongoose.disconnect();
  }
}
