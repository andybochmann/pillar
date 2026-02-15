import { NextResponse } from "next/server";
import { validateBearerToken } from "@/lib/mcp-auth";
import { handleMcpRequest } from "@/lib/mcp-server";

async function handleRequest(request: Request) {
  const userId = await validateBearerToken(request.headers.get("authorization"));
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return handleMcpRequest(request, userId);
}

export const POST = handleRequest;
export const GET = handleRequest;
export const DELETE = handleRequest;
