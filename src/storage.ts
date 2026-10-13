import { openDB } from "idb";
import { DEFAULT_SETTINGS, newConversation } from "./types";
import type { Conversation, Message, Settings } from "./types";

const dbPromise = openDB("yorha-companion", 1, {
  upgrade(db) {
    db.createObjectStore("preferences");
    db.createObjectStore("conversations", { keyPath: "id" });
    db.createObjectStore("vault");
  },
});
export async function saveSettings(settings: Settings) {
  return (await dbPromise).put("preferences", settings, "settings");
}
export async function saveConversation(conversation: Conversation) {
  return (await dbPromise).put("conversations", conversation);
}
export async function removeConversation(id: string) {
  return (await dbPromise).delete("conversations", id);
}
export async function saveActive(id: string) {
  return (await dbPromise).put("preferences", id, "active");
}

// The non-extractable CryptoKey stays on the same device in IndexedDB.
// This protects stored bytes, but cannot protect against scripts executing in this origin.
export async function rememberKey(provider: string, value: string) {
  const db = await dbPromise;
  if (!value) {
    await db.delete("vault", "secret:" + provider);
    return;
  }
  let key = (await db.get("vault", "device-key")) as CryptoKey | undefined;
  if (!key) {
    key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
    await db.put("vault", key, "device-key");
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(value),
  );
  await db.put("vault", { iv, ciphertext }, "secret:" + provider);
}
export async function readKey(provider: string): Promise<string> {
  const db = await dbPromise;
  const record = await db.get("vault", "secret:" + provider);
  if (!record) return "";
  const key = await db.get("vault", "device-key");
  if (!key)
    throw new Error(
      "La clé enregistrée ne peut plus être déchiffrée. Saisissez-la à nouveau.",
    );
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: record.iv },
    key,
    record.ciphertext,
  );
  return new TextDecoder().decode(plain);
}
export async function loadApplication() {
  const db = await dbPromise;
  let settings = (await db.get("preferences", "settings")) as
    | Settings
    | undefined;
  let conversations = (await db.getAll("conversations")) as Conversation[];
  // Preserve the first version’s history when this app is updated on the same origin.
  if (!settings) {
    settings = { ...DEFAULT_SETTINGS };
    try {
      const legacy = JSON.parse(localStorage.getItem("yorha-2b-v1") || "null");
      if (legacy?.config) {
        const p = legacy.config.provider;
        if (["demo", "openai", "openrouter", "custom"].includes(p))
          settings.provider = p;
        settings.model = legacy.config.model || "";
        settings.endpoint = legacy.config.endpoint || "";
      }
      if (Array.isArray(legacy?.messages) && !conversations.length) {
        const c = newConversation();
        c.title = "Conversation précédente";
        c.messages = legacy.messages
          .filter(
            (m: Message) =>
              ["user", "assistant"].includes(m.role) &&
              typeof m.content === "string",
          )
          .map((m: Message & { time?: number }) => ({
            id: crypto.randomUUID(),
            role: m.role,
            content: m.content,
            timestamp: m.time || Date.now(),
          }));
        if (c.messages.length) {
          await saveConversation(c);
          conversations.push(c);
        }
      }
    } catch {
      /* A damaged legacy export must not block the app. */
    }
    await saveSettings(settings);
  }
  if (!conversations.length) {
    const c = newConversation();
    await saveConversation(c);
    conversations = [c];
  }
  conversations.sort((a, b) => b.updatedAt - a.updatedAt);
  const stored = await db.get("preferences", "active");
  const active =
    conversations.find((c) => c.id === stored)?.id || conversations[0].id;
  return {
    settings: { ...DEFAULT_SETTINGS, ...settings },
    conversations,
    active,
  };
}
