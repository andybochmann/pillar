import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/task";
import { Note } from "@/models/note";
import { Project } from "@/models/project";
import { Category } from "@/models/category";
import { getAccessibleProjectIds } from "@/lib/project-access";

const MAX_RESULTS_PER_TYPE = 20;
const MAX_QUERY_LENGTH = 200;

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json(
      { error: "Search query is required" },
      { status: 400 },
    );
  }

  if (q.length > MAX_QUERY_LENGTH) {
    return NextResponse.json(
      { error: `Search query must be ${MAX_QUERY_LENGTH} characters or fewer` },
      { status: 400 },
    );
  }

  try {
    await connectDB();

    const includeArchived = searchParams.get("includeArchived") === "true";

    // Get all project IDs accessible to the user
    const accessibleIds = await getAccessibleProjectIds(session.user.id);
    const accessibleObjectIds = accessibleIds.map(
      (id) => new mongoose.Types.ObjectId(id),
    );

    // Search active tasks
    const taskFilter: Record<string, unknown> = {
      projectId: { $in: accessibleObjectIds },
      archived: { $ne: true },
      $text: { $search: q },
    };
    const tasksPromise = Task.find(taskFilter)
      .limit(MAX_RESULTS_PER_TYPE)
      .lean();

    // Search archived tasks (only when requested)
    const archivedTasksPromise = includeArchived
      ? Task.find({
          projectId: { $in: accessibleObjectIds },
          archived: true,
          $text: { $search: q },
        })
          .limit(MAX_RESULTS_PER_TYPE)
          .lean()
      : Promise.resolve([]);

    // Search notes
    // Notes are accessible if:
    // 1. Category notes owned by the user
    // 2. Project/task notes in accessible projects
    const noteFilter: Record<string, unknown> = {
      $text: { $search: q },
      $or: [
        { parentType: "category", userId: session.user.id },
        { projectId: { $in: accessibleObjectIds } },
      ],
    };
    const notesPromise = Note.find(noteFilter)
      .limit(MAX_RESULTS_PER_TYPE)
      .lean();

    const [tasks, archivedTasks, notes] = await Promise.all([
      tasksPromise,
      archivedTasksPromise,
      notesPromise,
    ]);

    // Collect all project IDs and category IDs for name resolution
    const projectIdSet = new Set<string>();
    const categoryIdSet = new Set<string>();
    const taskIdSet = new Set<string>();

    for (const task of [...tasks, ...archivedTasks]) {
      projectIdSet.add(task.projectId.toString());
    }
    for (const note of notes) {
      if (note.projectId) projectIdSet.add(note.projectId.toString());
      if (note.categoryId) categoryIdSet.add(note.categoryId.toString());
      if (note.taskId) taskIdSet.add(note.taskId.toString());
    }

    // Resolve names in parallel
    const [projectMap, categoryMap, taskMap] = await Promise.all([
      projectIdSet.size > 0
        ? Project.find(
            { _id: { $in: Array.from(projectIdSet) } },
            { name: 1 },
          )
            .lean()
            .then((docs) =>
              Object.fromEntries(
                docs.map((d) => [d._id.toString(), d.name]),
              ),
            )
        : Promise.resolve({} as Record<string, string>),
      categoryIdSet.size > 0
        ? Category.find(
            { _id: { $in: Array.from(categoryIdSet) } },
            { name: 1 },
          )
            .lean()
            .then((docs) =>
              Object.fromEntries(
                docs.map((d) => [d._id.toString(), d.name]),
              ),
            )
        : Promise.resolve({} as Record<string, string>),
      taskIdSet.size > 0
        ? Task.find({ _id: { $in: Array.from(taskIdSet) } }, { title: 1 })
            .lean()
            .then((docs) =>
              Object.fromEntries(
                docs.map((d) => [d._id.toString(), d.title]),
              ),
            )
        : Promise.resolve({} as Record<string, string>),
    ]);

    // Enrich tasks with project name
    const enrichedTasks = tasks.map((task) => ({
      ...task,
      _id: task._id.toString(),
      projectId: task.projectId.toString(),
      projectName: projectMap[task.projectId.toString()] ?? "",
    }));

    const enrichedArchivedTasks = archivedTasks.map((task) => ({
      ...task,
      _id: task._id.toString(),
      projectId: task.projectId.toString(),
      projectName: projectMap[task.projectId.toString()] ?? "",
    }));

    // Enrich notes with parent name and content snippet (strip full content)
    const enrichedNotes = notes.map((note) => {
      let parentName = "";
      if (note.parentType === "category" && note.categoryId) {
        parentName = categoryMap[note.categoryId.toString()] ?? "";
      } else if (note.parentType === "project" && note.projectId) {
        parentName = projectMap[note.projectId.toString()] ?? "";
      } else if (note.parentType === "task" && note.taskId) {
        parentName = taskMap[note.taskId.toString()] ?? "";
      }

      const snippet = note.content
        ? note.content.slice(0, 100) +
          (note.content.length > 100 ? "..." : "")
        : "";

      const { content: _content, ...rest } = note;
      return {
        ...rest,
        _id: note._id.toString(),
        parentName,
        snippet,
      };
    });

    return NextResponse.json({
      tasks: enrichedTasks,
      notes: enrichedNotes,
      archivedTasks: enrichedArchivedTasks,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
