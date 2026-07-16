export default function StatCard({
  label,
  value,
  tone = "default",
  size = "md",
}: {
  label: string;
  value: string;
  tone?: "default" | "signal" | "ok" | "bad" | "steel";
  size?: "sm" | "md" | "lg";
}) {
  const toneColor = {
    default: "text-white",
    signal: "text-signal",
    ok: "text-ok",
    bad: "text-bad",
    steel: "text-steel-light",
  }[tone];

  const valueSize = { sm: "text-xl", md: "text-2xl", lg: "text-4xl" }[size];

  return (
    <div className="ticket p-4">
      <div className="text-[11px] font-mono uppercase tracking-wide text-asphalt-600/80 mb-2">
        {label}
      </div>
      <div className={`font-display ${valueSize} ${toneColor}`}>{value}</div>
    </div>
  );
}
