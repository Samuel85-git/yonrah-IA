import { PROVIDERS } from "./types";
import type { Message, Settings } from "./types";
import { systemPrompt } from "./persona";

export function validateEndpoint(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("Utilisez une URL HTTPS sans identifiants ni paramètres.");
  return url.href.replace(/\/$/, "");
}
export function contextMessages(messages: Message[]) {
  let characters = 0;
  const retained: { role: string; content: string }[] = [];
  for (const message of [...messages].reverse()) {
    if (message.status === "error") continue;
    if (characters + message.content.length > 60000 && retained.length) break;
    characters += message.content.length;
    retained.unshift({ role: message.role, content: message.content });
  }
  return retained;
}
export function discoveryReply(text: string) {
  if (/concentr|mission|travail/i.test(text))
    return "Une seule tâche à la fois. Définissez un objectif précis, puis commencez par la première étape.\nJe reste à vos côtés.\n\n[Découverte : réponse préécrite. Connectez une IA pour discuter librement.]";
  if (/9s|qui es|présente|identité/i.test(text))
    return "YoRHa No.2 Type B. Une unité de combat, assistée par le Pod 042. 9S est mon partenaire de reconnaissance.\n\n[Découverte : réponse préécrite, sans IA.]";
  return "Transmission reçue. Pour que je puisse répondre à votre message, établissez une liaison avec OpenAI ou OpenRouter dans les paramètres.\n\n[Découverte : réponse préécrite, sans IA.]";
}
export async function complete(
  settings: Settings,
  key: string,
  messages: Message[],
  signal: AbortSignal,
) {
  if (settings.provider === "demo") {
    await new Promise((resolve) => setTimeout(resolve, 650));
    return discoveryReply(messages.at(-1)?.content || "");
  }
  if (!key) throw new Error("Ajoutez votre clé API dans les paramètres.");
  const base =
    settings.provider === "custom"
      ? validateEndpoint(settings.endpoint)
      : PROVIDERS[settings.provider].base;
  let response: Response;
  try {
    response = await fetch(base + "/chat/completions", {
      method: "POST",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + key,
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: "system", content: systemPrompt(settings) },
          ...contextMessages(messages),
        ],
        ...(settings.provider === "openai"
          ? { max_completion_tokens: 1200 }
          : { max_tokens: 1200 }),
      }),
      signal,
    });
  } catch (error) {
    if (signal.aborted)
      throw new Error(
        "La transmission a été interrompue ou le fournisseur n’a pas répondu à temps.",
      );
    throw new Error(
      "Connexion impossible. Vérifiez votre réseau et les autorisations CORS du fournisseur.",
    );
  }
  if (!response.ok) {
    const descriptions: Record<number, string> = {
      401: "Clé API refusée.",
      403: "Accès au fournisseur ou au modèle refusé.",
      404: "Modèle ou URL introuvable.",
      429: "Limite atteinte ou crédits insuffisants.",
    };
    throw new Error(
      descriptions[response.status] ||
        `Erreur du fournisseur (${response.status}).`,
    );
  }
  const result = await response.json();
  const text = result?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim())
    throw new Error("Réponse vide ou format incompatible.");
  return text;
}
