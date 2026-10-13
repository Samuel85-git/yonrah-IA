import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openDB } from "idb";
import {
  rememberKey,
  readKey,
  saveSettings,
  saveConversation,
  loadApplication,
  removeConversation,
  saveActive,
} from "../src/storage";
import { DEFAULT_SETTINGS, newConversation } from "../src/types";
import { systemPrompt } from "../src/persona";
import { complete, contextMessages, validateEndpoint } from "../src/chat";

beforeEach(async () => {
  const db = await openDB("yorha-companion");
  for (const name of ["preferences", "conversations", "vault"])
    await db.clear(name);
  vi.stubGlobal("localStorage", { getItem: () => null });
  vi.restoreAllMocks();
});
describe("mémoire durable", () => {
  it("conserve une clé chiffrée et permet sa suppression sans la stocker en clair", async () => {
    await rememberKey("openrouter", "test-secret");
    const db = await openDB("yorha-companion");
    const record = await db.get("vault", "secret:openrouter");
    expect(record.ciphertext).toBeInstanceOf(ArrayBuffer);
    expect(new TextDecoder().decode(record.ciphertext)).not.toContain(
      "test-secret",
    );
    expect((await db.get("vault", "device-key")).extractable).toBe(false);
    expect(await readKey("openrouter")).toBe("test-secret");
    await rememberKey("openrouter", "");
    expect(await readKey("openrouter")).toBe("");
  });
  it("restaure les conversations, la conversation active et les notes", async () => {
    const a = newConversation(),
      b = newConversation();
    a.title = "Projet A";
    b.title = "Projet B";
    await saveConversation(a);
    await saveConversation(b);
    await saveActive(a.id);
    await saveSettings({
      ...DEFAULT_SETTINGS,
      memory: "Je travaille sur le projet A.",
    });
    const state = await loadApplication();
    expect(state.conversations).toHaveLength(2);
    expect(state.active).toBe(a.id);
    expect(state.settings.memory).toContain("projet A");
    await removeConversation(b.id);
    expect((await loadApplication()).conversations).toHaveLength(1);
  });
  it("reprend l’ancien historique lors d’une mise à jour", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () =>
        JSON.stringify({
          config: { provider: "openrouter", model: "example/model" },
          messages: [
            { role: "user", content: "Message précédent", time: 1000 },
          ],
        }),
    });
    const data = await loadApplication();
    expect(data.settings.provider).toBe("openrouter");
    expect(data.conversations[0].messages[0].content).toBe("Message précédent");
    expect(data.conversations[0].messages[0].timestamp).toBe(1000);
  });
});
describe("liaison IA", () => {
  it("transmet l’identité de 2B, la mémoire et la conversation au bon fournisseur", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "Liaison établie." } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const c = newConversation();
    c.messages.push({
      id: "last",
      role: "user",
      content: "Tu connais mon projet ?",
      timestamp: 1,
    });
    const settings = {
      ...DEFAULT_SETTINGS,
      provider: "openrouter" as const,
      model: "test/model",
      memory: "Projet A",
    };
    expect(
      await complete(
        settings,
        "test-key",
        c.messages,
        new AbortController().signal,
      ),
    ).toBe("Liaison établie.");
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    const body = JSON.parse(options.body);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[0].content).toContain("YoRHa No.2 Type B");
    expect(body.messages[0].content).toContain("Projet A");
    expect(body.messages[0].content).toContain("SANS SPOILERS");
    expect(body.messages.at(-1).content).toBe("Tu connais mon projet ?");
    expect(options.credentials).toBe("omit");
  });
  it("signale une clé refusée sans l’exposer dans l’erreur", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 401 })),
    );
    await expect(
      complete(
        { ...DEFAULT_SETTINGS, provider: "openai", model: "test" },
        "test-key",
        [],
        new AbortController().signal,
      ),
    ).rejects.toThrow("Clé API refusée");
  });
  it("refuse les URL non HTTPS et les identifiants dans les URL", () => {
    expect(() => validateEndpoint("http://example.com/v1")).toThrow();
    expect(() =>
      validateEndpoint("https://user:secret@example.com/v1"),
    ).toThrow();
    expect(validateEndpoint("https://example.com/v1/")).toBe(
      "https://example.com/v1",
    );
  });
  it("limite le contexte sans supprimer l’historique conservé", () => {
    const c = newConversation();
    c.messages = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      role: "user" as const,
      content: "a".repeat(8000),
      timestamp: i,
    }));
    const context = contextMessages(c.messages);
    expect(context.length).toBeLessThan(c.messages.length);
    expect(c.messages).toHaveLength(20);
    expect(context.at(-1)?.content).toBe(c.messages.at(-1)?.content);
  });
  it("garde le canon et traite les notes comme du contexte", () => {
    const prompt = systemPrompt({
      ...DEFAULT_SETTINGS,
      memory: "Prénom : Samuel",
      spoilers: true,
    });
    expect(prompt).toContain("Pod 042");
    expect(prompt).toContain("9S");
    expect(prompt).toContain("SPOILERS AUTORISÉS");
    expect(prompt).toContain("<user_memory>");
  });
});
