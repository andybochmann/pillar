import { NextResponse } from "next/server";
import { z } from "zod";
import { generateObject, jsonSchema } from "ai";
import { auth } from "@/lib/auth";
import { isAIEnabled, isAIAllowedForUser, getAIModel } from "@/lib/ai";
import { connectDB } from "@/lib/db";
import { Project } from "@/models/project";
import { Task } from "@/models/task";
import { requireProjectRole } from "@/lib/project-access";

const RequestSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  maxCount: z.number().int().min(1).max(20).optional(),
});

const TASKS_SCHEMA = jsonSchema({
  type: "object" as const,
  properties: {
    tasks: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          title: { type: "string" as const },
          description: { type: "string" as const },
          priority: {
            type: "string" as const,
            enum: ["urgent", "high", "medium", "low"],
          },
          columnId: { type: "string" as const },
          subtasks: {
            type: "array" as const,
            items: { type: "string" as const },
          },
        },
        required: ["title", "priority", "columnId"],
      },
    },
  },
  required: ["tasks"],
});

interface GeneratedTask {
  title: string;
  description?: string;
  priority: string;
  columnId: string;
  subtasks?: string[];
}

interface TasksResponse {
  tasks: GeneratedTask[];
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAIEnabled()) {
    return NextResponse.json(
      { error: "AI is not configured" },
      { status: 503 },
    );
  }

  if (!isAIAllowedForUser(session.user.email)) {
    return NextResponse.json(
      { error: "AI is not available for this user" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const result = RequestSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 },
    );
  }

  const { projectId, maxCount } = result.data;
  const count = maxCount ?? 8;

  await connectDB();

  try {
    await requireProjectRole(session.user.id, projectId, "editor");
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: (err as Error).message },
      { status },
    );
  }

  const project = await Project.findById(projectId).lean();
  if (!project) {
    return NextResponse.json(
      { error: "Project not found" },
      { status: 404 },
    );
  }

  const existingTasks = await Task.find(
    { projectId },
    { title: 1 },
  ).lean();
  const existingTitles = existingTasks.map((t) => t.title);

  const columns = project.columns
    .sort((a, b) => a.order - b.order)
    .map((c) => ({ id: c.id, name: c.name }));
  const firstColumnId = columns[0]?.id ?? "todo";

  const parts = [
    `Generate ${count} tasks for this project.`,
    "",
    `Project: ${project.name}`,
  ];

  if (project.description) {
    parts.push(`Description: ${project.description}`);
  }

  parts.push(
    "",
    "Available columns (use these exact IDs for columnId):",
    ...columns.map((c) => `- "${c.id}" = ${c.name}`),
  );

  if (existingTitles.length > 0) {
    parts.push(
      "",
      "Existing tasks (do NOT duplicate these):",
      ...existingTitles.map((t) => `- ${t}`),
    );
  }

  parts.push(
    "",
    "Rules:",
    "- Create practical, actionable tasks relevant to the project",
    "- Start each title with an action verb",
    "- Keep titles under 80 characters",
    "- Assign appropriate priorities (urgent, high, medium, low)",
    `- Distribute tasks across the available columns using their exact IDs`,
    "- Optionally include 2-4 subtasks per task as short strings",
    `- Return exactly ${count} tasks`,
  );

  const prompt = parts.join("\n");

  try {
    const { object } = await generateObject({
      model: getAIModel(),
      schema: TASKS_SCHEMA,
      prompt,
    });

    const response = object as TasksResponse;
    const validColumnIds = new Set(columns.map((c) => c.id));

    const tasks = response.tasks.map((task) => ({
      ...task,
      columnId: validColumnIds.has(task.columnId)
        ? task.columnId
        : firstColumnId,
      subtasks: task.subtasks ?? [],
    }));

    return NextResponse.json({ tasks });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate tasks" },
      { status: 500 },
    );
  }
}
