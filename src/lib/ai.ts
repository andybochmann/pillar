import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

const DEFAULT_MODELS: Record<string, string> = {
  openai: "gpt-4.1-mini",
  google: "gemini-2.0-flash",
};

export function isAIEnabled(): boolean {
  return !!process.env.AI_API_KEY;
}

export function isAIAllowedForUser(email?: string | null): boolean {
  const allowedEmails = process.env.AI_ALLOWED_EMAILS;
  if (!allowedEmails) return true;
  if (!email) return false;
  const list = allowedEmails.split(",").map((e) => e.trim().toLowerCase());
  return list.includes(email.toLowerCase());
}

export function getAIModel() {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) throw new Error("AI_API_KEY is not configured");

  const provider = process.env.AI_PROVIDER ?? "openai";
  const model = process.env.AI_MODEL ?? DEFAULT_MODELS[provider];

  if (provider === "google") {
    const google = createGoogleGenerativeAI({ apiKey });
    return google(model);
  }

  const openai = createOpenAI({ apiKey });
  return openai(model);
}
