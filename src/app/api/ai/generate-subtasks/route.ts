import { NextResponse } from "next/server";
import { z } from "zod";
import { generateObject, jsonSchema } from "ai";
import { auth } from "@/lib/auth";
import { isAIEnabled, isAIAllowedForUser, getAIModel } from "@/lib/ai";

const RequestSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  priority: z.string().optional(),
  existingSubtasks: z.array(z.string()).optional(),
  maxCount: z.number().int().min(1).max(50).optional(),
});

const SUBTASKS_SCHEMA = jsonSchema({
  type: "object" as const,
  properties: {
    subtasks: {
      type: "array" as const,
      items: { type: "string" as const },
    },
  },
  required: ["subtasks"],
});

interface SubtasksResponse {
  subtasks: string[];
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

  const { title, description, priority, existingSubtasks, maxCount } =
    result.data;
  const count = maxCount ?? 5;

  const parts = [
    `Break down this task into ${count} actionable subtasks.`,
    "",
    `Task: ${title}`,
  ];

  if (description) parts.push(`Description: ${description}`);
  if (priority) parts.push(`Priority: ${priority}`);

  if (existingSubtasks?.length) {
    parts.push(
      "",
      "Existing subtasks (do NOT duplicate these):",
      ...existingSubtasks.map((s) => `- ${s}`),
    );
  }

  parts.push(
    "",
    "Rules:",
    "- Start each subtask with an action verb",
    "- Keep each under 80 characters",
    "- Order logically (dependencies first)",
    `- Return exactly ${count} subtasks`,
  );

  const prompt = parts.join("\n");

  try {
    const { object } = await generateObject({
      model: getAIModel(),
      schema: SUBTASKS_SCHEMA,
      prompt,
    });

    return NextResponse.json({
      subtasks: (object as SubtasksResponse).subtasks,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate subtasks" },
      { status: 500 },
    );
  }
}
