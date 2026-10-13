import { useCallback, useEffect, useRef, useState } from "react";
import {
  Settings2,
  MessageCircle,
  X,
  ArrowUp,
  Volume2,
  VolumeX,
  Sparkles,
  Scan,
  Focus,
  Hand,
  ChevronRight,
  History,
  Plus,
  Download,
  Trash2,
  Moon,
  Sun,
  Maximize2,
  BookOpen,
  Check,
  ArrowDownToLine,
  Square,
  Circle,
} from "lucide-react";
import Stage from "./components/Stage";
import SettingsPanel from "./components/Settings";
import { DEFAULT_SETTINGS, newConversation, PROVIDERS } from "./types";
import type { Action, Conversation, Message, Settings } from "./types";
import { complete, contextMessages } from "./chat";
import {
  loadApplication,
  readKey,
  rememberKey,
  saveActive,
  saveConversation,
  saveSettings,
  removeConversation,
} from "./storage";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
const motionLabels = {
  idle: "SYSTÈMES NOMINAUX",
  greet: "CONTACT ÉTABLI",
  agree: "TRANSMISSION REÇUE",
  focus: "MODE CONCENTRATION",
  thinking: "ANALYSE EN COURS",
  walk: "EN MOUVEMENT",
  speak: "LIAISON ACTIVE",
};

export default function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [key, setKey] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [panel, setPanel] = useState<"chat" | "history" | "memory" | null>(
    null,
  );
  const [showSettings, setShowSettings] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [speech, setSpeech] = useState("");
  const [modelReady, setModelReady] = useState(false);
  const [action, setAction] = useState<Action>({ type: "idle", id: 0 });
  const [reset, setReset] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [memoryDraft, setMemoryDraft] = useState("");
  const [savingMemory, setSavingMemory] = useState(false);
  const busyRef = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const speechTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const motionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const active = conversations.find((c) => c.id === activeId);
  const connected = settings.provider !== "demo" && !!key;
  const notify = useCallback((value: string) => {
    setToast(value);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4200);
  }, []);
  useEffect(() => {
    let cancelled = false;
    loadApplication()
      .then((data) => {
        if (!cancelled) {
          setSettings(data.settings);
          setMemoryDraft(data.settings.memory);
          setConversations(data.conversations);
          setActiveId(data.active);
          setLoaded(true);
        }
        readKey(data.settings.provider)
          .then((savedKey) => {
            if (!cancelled) setKey(savedKey);
          })
          .catch((e) => {
            if (!cancelled) notify(e.message);
          });
      })
      .catch((e) => {
        if (!cancelled) {
          setLoaded(true);
          setError("La mémoire locale est indisponible : " + e.message);
          const c = newConversation();
          setConversations([c]);
          setActiveId(c.id);
        }
      });
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(media.matches);
    const change = () => setReduced(media.matches);
    media.addEventListener("change", change);
    const beforeInstall = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    return () => {
      cancelled = true;
      media.removeEventListener("change", change);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      controller.current?.abort();
      if (speechTimer.current) clearTimeout(speechTimer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (motionTimer.current) clearTimeout(motionTimer.current);
      if ("speechSynthesis" in window) speechSynthesis.cancel();
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = settings.night ? "night" : "day";
  }, [settings.night]);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [active?.messages.length, busy, panel]);
  const onReady = useCallback((ready: boolean) => {
    setModelReady(ready);
  }, []);
  const trigger = useCallback((type: Action["type"], words?: string) => {
    setAction({ type, id: Date.now() });
    if (motionTimer.current) clearTimeout(motionTimer.current);
    if (!["thinking", "focus", "speak"].includes(type))
      motionTimer.current = setTimeout(
        () => setAction({ type: "idle", id: Date.now() }),
        type === "walk" ? 7000 : 4000,
      );
    if (words) {
      setSpeech(words);
      if (speechTimer.current) clearTimeout(speechTimer.current);
      speechTimer.current = setTimeout(() => setSpeech(""), 4500);
    }
  }, []);
  const touch = useCallback(() => {
    trigger(
      "greet",
      [
        "Contact reçu. Je suis là.",
        "Vous avez besoin de moi ?",
        "Liaison confirmée.",
      ][Math.floor(Math.random() * 3)],
    );
    navigator.vibrate?.(12);
  }, [trigger]);
  const storeConversation = useCallback(
    async (conversation: Conversation) => {
      setConversations((items) =>
        [...items.filter((c) => c.id !== conversation.id), conversation].sort(
          (a, b) => b.updatedAt - a.updatedAt,
        ),
      );
      try {
        await saveConversation(conversation);
      } catch {
        notify(
          "Impossible d’enregistrer cette conversation. Vérifiez l’espace disponible.",
        );
      }
    },
    [notify],
  );
  async function applySettings(next: Settings, secret: string) {
    if (busyRef.current) throw new Error("Attendez la fin de la transmission.");
    if (next.provider !== "demo") await rememberKey(next.provider, secret);
    await saveSettings(next);
    setSettings(next);
    setKey(next.provider === "demo" ? "" : secret);
    setMemoryDraft(next.memory);
    notify("Liaison enregistrée sur cet appareil.");
  }
  async function preference(update: Partial<Settings>) {
    const next = { ...settings, ...update };
    setSettings(next);
    try {
      await saveSettings(next);
    } catch {
      notify("Les préférences n’ont pas pu être conservées.");
    }
  }
  function readAloud(text: string) {
    if (!settings.voice || !("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "fr-FR";
    utterance.rate = 0.92;
    utterance.onend = () => trigger("idle");
    utterance.onerror = () => trigger("idle");
    trigger("speak");
    speechSynthesis.speak(utterance);
  }
  async function send(e?: React.FormEvent, text = input) {
    e?.preventDefault();
    text = text.trim();
    if (!text || busyRef.current || !active) return;
    if (settings.provider !== "demo" && !key) {
      setShowSettings(true);
      return;
    }
    if (text.length > 8000) {
      notify("Votre message est limité à 8 000 caractères.");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError("");
    setInput("");
    if (composer.current) composer.current.style.height = "auto";
    const user: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    const snapshot = {
      ...active,
      title: active.messages.some((m) => m.role === "user")
        ? active.title
        : text.slice(0, 48),
      updatedAt: Date.now(),
      messages: [...active.messages, user],
    };
    await storeConversation(snapshot);
    trigger("thinking");
    controller.current = new AbortController();
    const timeout = setTimeout(() => controller.current?.abort(), 65000);
    try {
      const response = await complete(
        settings,
        key,
        snapshot.messages,
        controller.current.signal,
      );
      const updated = {
        ...snapshot,
        updatedAt: Date.now(),
        messages: [
          ...snapshot.messages,
          {
            id: crypto.randomUUID(),
            role: "assistant" as const,
            content: response,
            timestamp: Date.now(),
          },
        ],
      };
      await storeConversation(updated);
      trigger("agree");
      readAloud(response);
    } catch (e) {
      setError((e as Error).message);
      trigger("idle");
    } finally {
      clearTimeout(timeout);
      controller.current = null;
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function freshConversation() {
    if (busyRef.current) return;
    const c = newConversation();
    await storeConversation(c);
    setActiveId(c.id);
    await saveActive(c.id);
    setInput("");
    setError("");
    setPanel("chat");
    trigger("agree", "Une nouvelle transmission. Je vous écoute.");
  }
  async function selectConversation(id: string) {
    if (busyRef.current) return;
    setActiveId(id);
    await saveActive(id);
    setError("");
    setPanel("chat");
  }
  async function deleteConversation(id: string) {
    if (busyRef.current) return;
    await removeConversation(id);
    const remaining = conversations.filter((c) => c.id !== id);
    if (!remaining.length) {
      const c = newConversation();
      await saveConversation(c);
      remaining.push(c);
    }
    setConversations(remaining);
    if (activeId === id) {
      setActiveId(remaining[0].id);
      await saveActive(remaining[0].id);
    }
    notify("Conversation supprimée.");
  }
  function exportConversations() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            version: 2,
            exportedAt: new Date().toISOString(),
            conversations,
            memory: settings.memory,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      "yorha-memoire-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function saveMemory() {
    setSavingMemory(true);
    try {
      const next = { ...settings, memory: memoryDraft };
      await saveSettings(next);
      setSettings(next);
      notify(
        "Notes conservées. 2B les retrouvera dans vos prochaines conversations.",
      );
    } catch {
      notify("La mémoire n’a pas pu être enregistrée.");
    } finally {
      setSavingMemory(false);
    }
  }
  async function installApp() {
    if (install) {
      await install.prompt();
      const choice = await install.userChoice;
      if (choice.outcome === "accepted") setInstall(null);
    } else
      notify(
        "Dans le menu du navigateur, choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».",
      );
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen)
        await document.documentElement.requestFullscreen();
      else notify("Le plein écran n’est pas disponible dans ce navigateur.");
    } catch {
      notify("Le plein écran n’est pas disponible ici.");
    }
  }
  return (
    <div className="companion-app">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="ambient ambient-three" />
      <div className="grain" />
      <Stage
        action={action}
        night={settings.night}
        reduced={reduced}
        onTouch={touch}
        onReady={onReady}
        reset={reset}
      />
      <header className="app-header">
        <a href="/" className="wordmark">
          <span className="yorha-mark">◇</span>
          <span>
            YoRHa<small>COMPANION / 2B</small>
          </span>
        </a>
        <div className="header-center glass">
          <span className="status-light" />
          <span>
            {modelReady ? "2B est à vos côtés" : "Initialisation de 2B"}
          </span>
        </div>
        <div className="header-actions">
          <button
            className="icon-glass"
            title="Installer l’application"
            aria-label="Installer l’application"
            onClick={installApp}
          >
            <ArrowDownToLine size={18} />
          </button>
          <button
            className="icon-glass"
            title="Paramètres"
            aria-label="Paramètres"
            onClick={() => setShowSettings(true)}
          >
            <Settings2 size={18} />
          </button>
        </div>
      </header>
      <section className="unit-info">
        <span className="eyebrow">UNITÉ DE COMBAT · YoRHa</span>
        <h1>
          2B
          <span>
            Une présence.
            <br />
            Au-delà du silence.
          </span>
        </h1>
        <p>
          YoRHa No.2 Type B<small>Pod 042 · Assistance tactique</small>
        </p>
      </section>
      <div className="scene-status">
        <span className="status-dash" />
        <span data-testid="motion-label">{motionLabels[action.type]}</span>
        <small>MODÈLE 3D · ANIMATION SQUELETTIQUE</small>
      </div>
      <nav className="side-tools" aria-label="Votre espace">
        <button
          className={"icon-glass " + (panel === "history" ? "selected" : "")}
          aria-label="Historique des conversations"
          title="Transmissions"
          onClick={() => setPanel(panel === "history" ? null : "history")}
        >
          <History size={19} />
        </button>
        <button
          className={"icon-glass " + (panel === "memory" ? "selected" : "")}
          aria-label="Mémoire de 2B"
          title="Mémoire"
          onClick={() => setPanel(panel === "memory" ? null : "memory")}
        >
          <BookOpen size={19} />
        </button>
        <span />
        <button
          className="icon-glass"
          aria-label={settings.night ? "Ambiance jour" : "Ambiance nuit"}
          title="Ambiance"
          onClick={() => preference({ night: !settings.night })}
        >
          {settings.night ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button
          className="icon-glass"
          aria-label="Recentrer la caméra"
          title="Recentrer"
          onClick={() => setReset((value) => value + 1)}
        >
          <Scan size={18} />
        </button>
        <button
          className="icon-glass"
          aria-label="Plein écran"
          title="Plein écran"
          onClick={fullscreen}
        >
          <Maximize2 size={17} />
        </button>
      </nav>
      {speech && (
        <div className="companion-speech glass" role="status">
          <span className="speech-diamond">◇</span>
          {speech}
        </div>
      )}
      <div className="interaction-hint">
        <span>Glissez pour explorer</span>
        <Circle size={3} />
        <span>Touchez pour interagir</span>
      </div>
      <div
        className="action-dock glass"
        role="group"
        aria-label="Interactions avec 2B"
      >
        <button
          className="dock-button"
          onClick={() => trigger("greet", "Liaison établie. Bonjour.")}
        >
          <Hand size={18} />
          <span>Saluer</span>
        </button>
        <button
          className="dock-button"
          onClick={() => trigger("walk", "Vérification des systèmes moteurs.")}
        >
          <Sparkles size={18} />
          <span>Bouger</span>
        </button>
        <button
          className={
            "dock-button " + (action.type === "focus" ? "selected" : "")
          }
          onClick={() =>
            trigger(
              action.type === "focus" ? "idle" : "focus",
              action.type === "focus"
                ? "Pause terminée."
                : "Un objectif. Une étape à la fois.",
            )
          }
        >
          <Focus size={18} />
          <span>Concentration</span>
        </button>
        <div className="dock-divider" />
        <button
          className={
            "dock-button chat-toggle " + (panel === "chat" ? "selected" : "")
          }
          onClick={() => {
            setPanel(panel === "chat" ? null : "chat");
            setTimeout(() => composer.current?.focus(), 100);
          }}
        >
          <MessageCircle size={18} />
          <span>Discuter</span>
          <span className="connection-dot" data-connected={connected} />
        </button>
      </div>
      <div className="world-caption">
        POUR LA GLOIRE DE L’HUMANITÉ<span>Un espace à vous.</span>
      </div>
      {panel && (
        <aside
          className="drawer glass"
          aria-label={
            panel === "chat"
              ? "Conversation avec 2B"
              : panel === "history"
                ? "Historique"
                : "Mémoire de 2B"
          }
        >
          <div className="drawer-header">
            <div className="drawer-title">
              {panel === "chat" ? (
                <>
                  <img src="/assets/avatar.png" alt="" />
                  <div>
                    <h2>2B</h2>
                    <p>
                      <span className="status-light" />
                      {connected
                        ? PROVIDERS[settings.provider].name + " · connecté"
                        : "Mode découverte"}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="drawer-symbol">
                    {panel === "history" ? (
                      <History size={21} />
                    ) : (
                      <BookOpen size={21} />
                    )}
                  </div>
                  <div>
                    <h2>{panel === "history" ? "Transmissions" : "Mémoire"}</h2>
                    <p>
                      {panel === "history"
                        ? `${conversations.length} conversation${conversations.length > 1 ? "s" : ""} conservée${conversations.length > 1 ? "s" : ""}`
                        : "Ce que 2B doit garder à l’esprit"}
                    </p>
                  </div>
                </>
              )}
            </div>
            <button
              className="icon-plain"
              aria-label="Fermer le panneau"
              onClick={() => setPanel(null)}
            >
              <X size={18} />
            </button>
          </div>
          {panel === "chat" && (
            <>
              <div className="chat-toolbar">
                <span>{active?.title}</span>
                <button
                  className="icon-plain"
                  disabled={busy}
                  onClick={freshConversation}
                  aria-label="Nouvelle conversation"
                  title="Nouvelle conversation"
                >
                  <Plus size={16} />
                </button>
              </div>
              <div
                ref={log}
                className="message-log"
                role="log"
                aria-live="polite"
              >
                <div className="log-day">LIAISON PERSONNELLE / 2B</div>
                {active?.messages.map((message) => (
                  <div className={"message " + message.role} key={message.id}>
                    <span className="message-author">
                      {message.role === "assistant" ? "◇ 2B" : "VOUS"}
                    </span>
                    <div className="message-content">{message.content}</div>
                    <time>
                      {new Date(message.timestamp).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                ))}
                {busy && (
                  <div className="message">
                    <span className="message-author">◇ 2B</span>
                    <div className="typing">
                      <i />
                      <i />
                      <i />
                      <span>Analyse en cours</span>
                    </div>
                  </div>
                )}
              </div>
              {(active?.messages.length || 0) < 2 && (
                <div className="suggestions">
                  <button onClick={() => send(undefined, "Présente-toi, 2B.")}>
                    Présente-toi
                  </button>
                  <button
                    onClick={() => send(undefined, "Aide-moi à me concentrer.")}
                  >
                    Notre prochaine mission
                  </button>
                </div>
              )}
              <div className="composer-area">
                {error && (
                  <div className="chat-error" role="alert">
                    {error}
                    <button onClick={() => setShowSettings(true)}>
                      Vérifier la liaison <ChevronRight size={12} />
                    </button>
                  </div>
                )}
                <form className="composer" onSubmit={(e) => send(e)}>
                  <textarea
                    ref={composer}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height =
                        Math.min(e.target.scrollHeight, 100) + "px";
                    }}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        !e.shiftKey &&
                        !e.nativeEvent.isComposing
                      ) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    rows={1}
                    maxLength={8000}
                    aria-label="Message à 2B"
                    placeholder="Une pensée pour 2B…"
                  />
                  {busy ? (
                    <button
                      type="button"
                      className="send-button"
                      aria-label="Interrompre la réponse"
                      onClick={() => controller.current?.abort()}
                    >
                      <Square size={13} />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="send-button"
                      aria-label="Envoyer"
                      disabled={!loaded || !input.trim()}
                    >
                      <ArrowUp size={19} />
                    </button>
                  )}
                </form>
                <div className="composer-meta">
                  <button
                    onClick={() => {
                      if (!("speechSynthesis" in window)) {
                        notify(
                          "La voix n’est pas disponible dans ce navigateur.",
                        );
                        return;
                      }
                      if (settings.voice) speechSynthesis.cancel();
                      preference({ voice: !settings.voice });
                    }}
                    aria-label={
                      settings.voice ? "Désactiver la voix" : "Activer la voix"
                    }
                    aria-pressed={settings.voice}
                  >
                    {settings.voice ? (
                      <Volume2 size={12} />
                    ) : (
                      <VolumeX size={12} />
                    )}
                    Voix {settings.voice ? "active" : "inactive"}
                  </button>
                  <span>Mémoire locale active</span>
                </div>
              </div>
              <button
                className="provider-bar"
                onClick={() => setShowSettings(true)}
              >
                <div>
                  <span className="status-light" />
                  {connected
                    ? "Liaison " + PROVIDERS[settings.provider].name
                    : settings.provider === "demo"
                      ? "Connecter une intelligence artificielle"
                      : "Clé API à renseigner"}
                  <small>
                    {connected
                      ? settings.model
                      : "OpenAI · OpenRouter · API externe"}
                  </small>
                </div>
                <ChevronRight size={16} />
              </button>
              {active &&
                contextMessages(active.messages).length <
                  active.messages.length && (
                  <div className="context-note">
                    Historique conservé en entier. Les échanges récents et vos
                    notes sont envoyés au modèle.
                  </div>
                )}
            </>
          )}
          {panel === "history" && (
            <div className="history-content">
              <button
                className="button outline"
                disabled={busy}
                onClick={freshConversation}
              >
                <Plus size={16} />
                Nouvelle transmission
              </button>
              <div className="conversation-list">
                {conversations.map((c) => (
                  <div
                    className={
                      "conversation-item " +
                      (c.id === activeId ? "current" : "")
                    }
                    key={c.id}
                  >
                    <button
                      className="conversation-select"
                      disabled={busy}
                      onClick={() => selectConversation(c.id)}
                    >
                      <span>{c.title}</span>
                      <small>
                        {new Date(c.updatedAt).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                        })}{" "}
                        · {c.messages.length} messages
                      </small>
                    </button>
                    <button
                      className="icon-plain"
                      disabled={busy}
                      aria-label={"Supprimer " + c.title}
                      onClick={() => deleteConversation(c.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="button export-button"
                onClick={exportConversations}
              >
                <Download size={15} />
                Exporter les discussions
              </button>
              <p className="field-note">
                Vos échanges sont conservés sur cet appareil. L’export n’inclut
                jamais votre clé API.
              </p>
            </div>
          )}
          {panel === "memory" && (
            <div className="memory-content">
              <div className="memory-intro">
                <span className="eyebrow">JOURNAL DU PARTENAIRE</span>
                <h3>
                  Se souvenir,
                  <br />
                  sans réinventer.
                </h3>
                <p>
                  Ajoutez les informations que vous souhaitez retrouver dans
                  toutes vos conversations : votre prénom, vos projets, vos
                  préférences.
                </p>
              </div>
              <label htmlFor="memory">Les repères de 2B</label>
              <textarea
                id="memory"
                maxLength={10000}
                rows={12}
                value={memoryDraft}
                onChange={(e) => setMemoryDraft(e.target.value)}
                placeholder="Ex. : Je m’appelle Samuel. Je travaille sur…"
              />
              <p className="field-note">
                Ces notes sont conservées sur cet appareil et transmises au
                fournisseur pendant le chat. 2B utilise aussi les échanges de la
                conversation ouverte.
              </p>
              <button
                className="button primary"
                disabled={savingMemory}
                onClick={saveMemory}
              >
                <Check size={16} />
                {savingMemory ? "Enregistrement…" : "Conserver ces souvenirs"}
              </button>
            </div>
          )}
        </aside>
      )}
      {showSettings && (
        <SettingsPanel
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSave={applySettings}
          onForget={(provider) => {
            if (provider === settings.provider) setKey("");
          }}
        />
      )}
      {toast && (
        <div className="toast glass" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
      {!panel && error && (
        <button
          className="storage-error glass"
          onClick={() => setPanel("chat")}
        >
          {error}
        </button>
      )}
      <div className="credits">
        <a
          href="https://sketchfab.com/3d-models/2b-nier-automata-d3e553bc325f4e0bb211f37a16f5ee12"
          target="_blank"
          rel="noreferrer"
        >
          Modèle 2B · Cyber · CC BY 4.0
        </a>
        <span>
          NieR:Automata © Square Enix / PlatinumGames · application non
          officielle
        </span>
      </div>
    </div>
  );
}
