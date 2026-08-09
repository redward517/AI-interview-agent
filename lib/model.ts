import { anthropic } from "@ai-sdk/anthropic";
import { groq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";

export function getModel(): LanguageModel {
  const provider = process.env.MODEL_PROVIDER ?? "anthropic";

  switch (provider) {
    case "anthropic":
      return anthropic("claude-sonnet-5");
    case "groq":
      return groq("llama-3.3-70b-versatile");
    default:
      throw new Error(`Unknown MODEL_PROVIDER: "${provider}". Expected "anthropic" or "groq".`);
  }
}
