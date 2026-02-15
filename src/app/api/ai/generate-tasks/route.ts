import { NextResponse } from "next/server";
import { z } from "zod";
import { generateObject } from "ai";
import { auth } from "@/lib/auth";
import { isAIEnabled, isAIAllowedForUser, getAIModel } from "@/lib/ai";
import { connectDB } from "@/lib/db";
import { Project } from "@/models/project";
import { Task } from "@/models/task";
import { requireProjectRole } from "@/lib/project-access";

const RequestSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  maxCount: z.number().int().min(1).max(20).optional(),
  context: z.string().max(2000).optional(),
});

const TasksSchema = z.object({
  tasks: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      priority: z.enum(["urgent", "high", "medium", "low"]),
      subtasks: z.array(z.string()),
    }),
  ),
});

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

  const { projectId, maxCount, context } = result.data;
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

  if (context) {
    parts.push(`Additional context: ${context}`);
  }

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
    "- Include 2-4 subtasks per task as short strings",
    `- Return exactly ${count} tasks`,
  );

  const prompt = parts.join("\n");

  try {
    const { object } = await generateObject({
      model: getAIModel(),
      schema: TasksSchema,
      prompt,
    });

    const tasks = object.tasks.map((task) => ({
      ...task,
      columnId: firstColumnId,
    }));

    return NextResponse.json({ tasks });
  } catch (err) {
    console.error("AI generate-tasks error:", err);
    return NextResponse.json(
      { error: "Failed to generate tasks" },
      { status: 500 },
    );
  }
}
