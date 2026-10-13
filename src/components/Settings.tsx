import { useEffect, useRef, useState } from "react";
import {
  X,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  Trash2,
  ChevronRight,
  UserRound,
} from "lucide-react";
import type { Settings as Config } from "../types";
import { PROVIDERS } from "../types";
import { IDENTITY } from "../persona";
import { readKey, rememberKey } from "../storage";
import { validateEndpoint } from "../chat";
type Props = {
  settings: Config;
  onClose: () => void;
  onForget: (provider: string) => void;
  onSave: (settings: Config, key: string) => Promise<void>;
};
export default function Settings({
  settings,
  onClose,
  onSave,
  onForget,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(settings);
  const [key, setKey] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const edited = useRef(false);
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  useEffect(() => {
    let cancelled = false;
    edited.current = false;
    setKey("");
    readKey(draft.provider)
      .then((value) => {
        if (!cancelled && !edited.current) setKey(value);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [draft.provider]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (draft.provider !== "demo" && !key.trim())
        throw new Error("Renseignez votre clé API.");
      if (draft.provider !== "demo" && !draft.model.trim())
        throw new Error("Renseignez un identifiant de modèle.");
      if (draft.provider === "custom") validateEndpoint(draft.endpoint);
      setSaving(true);
      await onSave(draft, key.trim());
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function forget() {
    try {
      await rememberKey(draft.provider, "");
      onForget(draft.provider);
      edited.current = true;
      setKey("");
      setError(
        "Clé supprimée de cet appareil. Enregistrez pour modifier le fournisseur actif.",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="settings-dialog glass"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) {
          const r = dialog.current.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <form onSubmit={save}>
        <div className="modal-header">
          <div>
            <span className="eyebrow">CONFIGURATION DE LA LIAISON</span>
            <h2>Un esprit. Votre IA.</h2>
          </div>
          <button
            type="button"
            className="icon-glass"
            onClick={onClose}
            aria-label="Fermer les paramètres"
          >
            <X size={18} />
          </button>
        </div>
        <div className="identity-card">
          <UserRound size={22} />
          <div>
            <b>YoRHa No.2 Type B</b>
            <p>Calme. Précise. Une présence, derrière le silence.</p>
          </div>
          <span className="tag">2B</span>
        </div>
        <label htmlFor="provider">
          Fournisseur d’intelligence artificielle
        </label>
        <select
          id="provider"
          value={draft.provider}
          onChange={(e) => {
            const p = e.target.value as Config["provider"];
            setDraft({ ...draft, provider: p, model: PROVIDERS[p].model });
            setError("");
          }}
        >
          {Object.entries(PROVIDERS).map(([id, p]) => (
            <option key={id} value={id}>
              {p.name}
              {id === "demo" ? " · sans IA connectée" : ""}
            </option>
          ))}
        </select>
        {draft.provider !== "demo" && (
          <>
            <label htmlFor="api-key">Clé API</label>
            <div className="secret-input">
              <KeyRound size={16} />
              <input
                id="api-key"
                type={visible ? "text" : "password"}
                autoComplete="off"
                spellCheck={false}
                value={key}
                onChange={(e) => {
                  edited.current = true;
                  setKey(e.target.value);
                }}
                placeholder="Votre clé API"
              />
              <button
                type="button"
                aria-label={visible ? "Masquer la clé" : "Afficher la clé"}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            <div className="field-note vault-note">
              <ShieldCheck size={13} />
              <span>
                Conservée sur cet appareil, chiffrée dans la mémoire locale.
              </span>
              <button
                type="button"
                onClick={forget}
                aria-label="Supprimer la clé enregistrée"
              >
                <Trash2 size={13} />
              </button>
            </div>
            <label htmlFor="model">Modèle</label>
            <input
              id="model"
              value={draft.model}
              maxLength={160}
              onChange={(e) => setDraft({ ...draft, model: e.target.value })}
              placeholder={
                PROVIDERS[draft.provider].model || "Identifiant du modèle"
              }
            />
            {draft.provider === "custom" && (
              <>
                <label htmlFor="endpoint">URL de base de l’API</label>
                <input
                  id="endpoint"
                  type="url"
                  value={draft.endpoint}
                  onChange={(e) =>
                    setDraft({ ...draft, endpoint: e.target.value })
                  }
                  placeholder="https://votre-service.example/v1"
                />
                <p className="field-note">
                  Votre clé et vos messages seront envoyés à ce service. Il doit
                  autoriser CORS.
                </p>
              </>
            )}
            <p className="field-note">
              {draft.provider === "openai"
                ? "La facturation API OpenAI est distincte de l’abonnement ChatGPT."
                : "Les appels sont facturés par votre fournisseur selon le modèle choisi."}
            </p>
          </>
        )}
        <div className="setting-toggle">
          <div>
            <b>Révélations de NieR:Automata</b>
            <p>Autoriser les spoilers et le passé de 2B.</p>
          </div>
          <button
            type="button"
            className={"switch " + (draft.spoilers ? "on" : "")}
            role="switch"
            aria-label="Autoriser les spoilers"
            aria-checked={draft.spoilers}
            onClick={() => setDraft({ ...draft, spoilers: !draft.spoilers })}
          >
            <span />
          </button>
        </div>
        <label htmlFor="extra-prompt">Vos préférences de conversation</label>
        <textarea
          id="extra-prompt"
          rows={2}
          maxLength={4000}
          value={draft.extraPrompt}
          onChange={(e) => setDraft({ ...draft, extraPrompt: e.target.value })}
          placeholder="Ex. : tutoiement, réponses courtes…"
        />
        <details className="prompt-details">
          <summary>
            Voir l’identité et le prompt système <ChevronRight size={14} />
          </summary>
          <pre>{IDENTITY}</pre>
          <a
            href="https://www.platinumgames.com/works/nier-automata"
            target="_blank"
            rel="noreferrer"
          >
            Description officielle du personnage ↗
          </a>
        </details>
        <p className="field-note">
          La mémoire reste dans ce navigateur, sur cet appareil. Les messages et
          les notes utiles sont transmis à l’IA lors d’une conversation. Cette
          application est une création de fan non officielle.
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button type="submit" className="button primary" disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer la liaison"}
          <ChevronRight size={16} />
        </button>
      </form>
    </dialog>
  );
}
