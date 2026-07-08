export function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-xs text-ink-muted">—</span>;
  const color =
    score >= 61 ? "bg-emerald-pos/15 text-emerald-pos" : score >= 31 ? "bg-amber/15 text-amber" : "bg-red-400/15 text-red-300";
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>
      {score}
    </span>
  );
}

export function StatusBadge({ label, status }: { label: string; status: string }) {
  const color =
    status === "ESCALATED"
      ? "border-red-400/40 text-red-300"
      : status === "APPOINTMENT_PROPOSED"
        ? "border-emerald-pos/40 text-emerald-pos"
        : status === "CLOSED"
          ? "border-night-border text-ink-muted"
          : "border-amber/40 text-amber-soft";
  return (
    <span className={`inline-block rounded-full border px-2.5 py-1 text-xs ${color}`}>
      {label}
    </span>
  );
}
