"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type {
  AgentProfession,
  AgentTone,
  AgentTurnResult,
  ChatMessage,
} from "@/lib/agent/types";

const PROFESSIONS: AgentProfession[] = ["tax", "immigration", "insurance"];
const TONES: AgentTone[] = ["professional", "formal", "concise"];

type EngineMode = "live" | "mock" | "unknown";

const selectClass =
  "w-full rounded-xl border border-night-border bg-night px-3 py-2.5 text-sm text-ink focus:border-amber focus:outline-none transition-colors";

export default function SandboxClient() {
  const t = useTranslations("sandbox");
  const searchParams = useSearchParams();

  const verticalParam = searchParams.get("vertical");
  const initialProfession: AgentProfession = PROFESSIONS.includes(
    verticalParam as AgentProfession,
  )
    ? (verticalParam as AgentProfession)
    : "tax";

  const [profession, setProfession] = useState<AgentProfession>(initialProfession);
  const [tone, setTone] = useState<AgentTone>("professional");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [analysis, setAnalysis] = useState<AgentTurnResult | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [mode, setMode] = useState<EngineMode>("unknown");

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Détecte si l'API tourne en mode live (clé Anthropic) ou simulation.
    fetch("/api/sandbox/chat")
      .then((r) => r.json())
      .then((d: { mode?: EngineMode }) => setMode(d.mode ?? "unknown"))
      .catch(() => setMode("unknown"));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, loading]);

  function reset(nextProfession?: AgentProfession, nextTone?: AgentTone) {
    setMessages([]);
    setAnalysis(null);
    setError(false);
    if (nextProfession) setProfession(nextProfession);
    if (nextTone) setTone(nextTone);
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError(false);

    try {
      const res = await fetch("/api/sandbox/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profession, tone, messages: nextMessages }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        ok: boolean;
        mode: EngineMode;
        result: AgentTurnResult;
      };
      if (!data.ok) throw new Error("engine_error");

      setMode(data.mode);
      setAnalysis(data.result);
      setMessages([...nextMessages, { role: "assistant", content: data.result.reply }]);
    } catch {
      setError(true);
      // Retire le message utilisateur non traité pour permettre un nouvel essai propre
      setMessages(messages);
      setInput(trimmed);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  const scoreColor =
    analysis == null
      ? "bg-night-border"
      : analysis.qualificationScore >= 61
        ? "bg-emerald-pos"
        : analysis.qualificationScore >= 31
          ? "bg-amber"
          : "bg-red-400";

  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr_320px]">
      {/* ── Panneau de configuration ─────────────────────────── */}
      <aside className="card h-fit p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-amber">
          {t("config.title")}
        </h2>

        <label className="mt-5 block">
          <span className="mb-1.5 block text-xs text-ink-muted">{t("config.profession")}</span>
          <select
            value={profession}
            onChange={(e) => reset(e.target.value as AgentProfession)}
            className={selectClass}
          >
            {PROFESSIONS.map((p) => (
              <option key={p} value={p}>
                {t(`config.professionOptions.${p}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs text-ink-muted">{t("config.tone")}</span>
          <select
            value={tone}
            onChange={(e) => reset(undefined, e.target.value as AgentTone)}
            className={selectClass}
          >
            {TONES.map((tn) => (
              <option key={tn} value={tn}>
                {t(`config.toneOptions.${tn}`)}
              </option>
            ))}
          </select>
        </label>

        <p className="mt-4 text-xs text-ink-muted">
          {t("config.firmLabel")} :{" "}
          <span className="text-ink">{t("config.firmValue")}</span>
        </p>

        <button
          type="button"
          onClick={() => reset()}
          className="btn-secondary mt-5 w-full !py-2 text-xs"
        >
          {t("config.reset")}
        </button>

        {mode !== "unknown" && (
          <p
            className={`mt-4 rounded-lg border px-3 py-2.5 text-xs leading-relaxed ${
              mode === "live"
                ? "border-emerald-pos/30 bg-emerald-pos/5 text-emerald-pos"
                : "border-amber/30 bg-amber/5 text-amber-soft"
            }`}
          >
            {mode === "live" ? t("config.liveNotice") : t("config.mockNotice")}
          </p>
        )}
      </aside>

      {/* ── Conversation ─────────────────────────────────────── */}
      <div className="card flex min-h-[480px] flex-col">
        <h2 className="border-b border-night-border px-5 py-3.5 text-sm font-semibold text-warmwhite">
          {t("chat.title")}
        </h2>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-ink-muted">{t("chat.empty")}</p>
              <button
                type="button"
                onClick={() => void send(t(`chat.suggestions.${profession}`))}
                className="max-w-sm rounded-xl border border-amber/30 bg-amber/5 px-4 py-3 text-sm text-amber-soft transition-colors hover:bg-amber/10"
              >
                « {t(`chat.suggestions.${profession}`)} »
              </button>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <p
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "rounded-br-sm bg-night-border text-ink"
                    : "rounded-bl-sm border border-amber/25 bg-amber/8 text-ink"
                }`}
              >
                {msg.content}
              </p>
            </div>
          ))}

          {loading && (
            <p className="text-xs italic text-ink-muted" aria-live="polite">
              {t("chat.thinking")}
            </p>
          )}
          {error && (
            <p role="alert" className="text-xs text-red-300">
              {t("chat.error")}
            </p>
          )}
          <div ref={chatEndRef} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex gap-2 border-t border-night-border p-4"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("chat.placeholder")}
            disabled={loading}
            className="flex-1 rounded-full border border-night-border bg-night px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted/60 focus:border-amber focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="btn-primary !px-5 !py-2.5 text-sm disabled:opacity-50"
          >
            {t("chat.send")}
          </button>
        </form>
      </div>

      {/* ── Analyse de l'agent ───────────────────────────────── */}
      <aside className="card h-fit p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-amber">
          {t("analysis.title")}
        </h2>
        <p className="mt-1.5 text-xs text-ink-muted">{t("analysis.subtitle")}</p>

        {analysis == null ? (
          <p className="mt-6 text-sm italic text-ink-muted">{t("analysis.waiting")}</p>
        ) : (
          <div className="mt-5 space-y-5">
            <div>
              <p className="flex items-baseline justify-between text-xs text-ink-muted">
                {t("analysis.score")}
                <span className="font-display text-2xl text-warmwhite">
                  {analysis.qualificationScore}
                  <span className="text-sm text-ink-muted">/100</span>
                </span>
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-night">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${scoreColor}`}
                  style={{ width: `${analysis.qualificationScore}%` }}
                />
              </div>
            </div>

            <div>
              <p className="text-xs text-ink-muted">{t("analysis.action")}</p>
              <p
                className={`mt-1.5 inline-block rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  analysis.recommendedAction === "ESCALATE"
                    ? "border-red-400/40 bg-red-400/10 text-red-300"
                    : analysis.recommendedAction === "PROPOSE_APPOINTMENT"
                      ? "border-emerald-pos/40 bg-emerald-pos/10 text-emerald-pos"
                      : "border-amber/40 bg-amber/10 text-amber-soft"
                }`}
              >
                {t(`analysis.actions.${analysis.recommendedAction}`)}
              </p>
            </div>

            <div>
              <p className="text-xs text-ink-muted">{t("analysis.language")}</p>
              <p className="mt-1 text-sm font-semibold text-warmwhite">
                {analysis.detectedLanguage === "FR" ? "Français" : "English"}
              </p>
            </div>

            <div>
              <p className="text-xs text-ink-muted">{t("analysis.summary")}</p>
              <p className="mt-1.5 rounded-xl bg-night px-3.5 py-3 text-xs leading-relaxed text-ink">
                {analysis.summaryForHuman}
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 border-t border-night-border pt-4">
          <p className="text-xs font-semibold text-warmwhite">{t("analysis.guardrails")}</p>
          <ul className="mt-2.5 space-y-1.5 text-xs text-ink-muted">
            {(["noAdvice", "noPricing", "disclosure", "language", "escalation"] as const).map(
              (g) => (
                <li key={g} className="flex items-start gap-2">
                  <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-pos" />
                  {t(`analysis.guardrailsList.${g}`)}
                </li>
              ),
            )}
          </ul>
        </div>
      </aside>
    </div>
  );
}
