import { AsyncLocalStorage } from "async_hooks";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { connectDB } from "@/lib/db";
import { registerCategoryTools } from "./mcp-tools/categories";
import { registerProjectTools } from "./mcp-tools/projects";
import { registerTaskTools } from "./mcp-tools/tasks";
import { registerSubtaskTools } from "./mcp-tools/subtasks";
import { registerLabelTools } from "./mcp-tools/labels";
import { registerNoteTools } from "./mcp-tools/notes";

interface McpAuthStore {
  userId: string;
}

export const mcpAuthContext = new AsyncLocalStorage<McpAuthStore>();

export function getMcpUserId(): string {
  const store = mcpAuthContext.getStore();
  if (!store) throw new Error("MCP auth context not available");
  return store.userId;
}

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "pillar",
    version: "1.0.0",
  });

  registerCategoryTools(server);
  registerProjectTools(server);
  registerTaskTools(server);
  registerSubtaskTools(server);
  registerLabelTools(server);
  registerNoteTools(server);

  return server;
}

export async function handleMcpRequest(
  request: Request,
  userId: string,
): Promise<Response> {
  const { WebStandardStreamableHTTPServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
  );

  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
  });

  const server = createMcpServer();

  await connectDB();

  return mcpAuthContext.run({ userId }, async () => {
    await server.connect(transport);
    return transport.handleRequest(request);
  });
}
