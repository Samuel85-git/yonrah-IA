export type Provider = "demo" | "openai" | "openrouter" | "custom";
export interface Settings {
  provider: Provider;
  model: string;
  endpoint: string;
  voice: boolean;
  spoilers: boolean;
  extraPrompt: string;
  memory: string;
  night: boolean;
}
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  status?: "error";
}
export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}
export type Motion =
  | "idle"
  | "greet"
  | "agree"
  | "focus"
  | "thinking"
  | "walk"
  | "speak";
export interface Action {
  type: Motion;
  id: number;
}
export const PROVIDERS = {
  demo: { name: "Découverte", model: "", base: "" },
  openai: {
    name: "OpenAI",
    model: "gpt-4.1-mini",
    base: "https://api.openai.com/v1",
  },
  openrouter: {
    name: "OpenRouter",
    model: "openai/gpt-4.1-mini",
    base: "https://openrouter.ai/api/v1",
  },
  custom: { name: "API compatible", model: "", base: "" },
};
export const DEFAULT_SETTINGS: Settings = {
  provider: "demo",
  model: "",
  endpoint: "",
  voice: false,
  spoilers: false,
  extraPrompt: "",
  memory: "",
  night: false,
};
export function newConversation(): Conversation {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: "Nouvelle transmission",
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "YoRHa, unité 2B. Liaison établie.\nJe reste à vos côtés. Quelle est notre prochaine mission ?",
        timestamp: now,
      },
    ],
  };
}
