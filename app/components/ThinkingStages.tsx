export type Stage = { tool: string; label: string; status: "active" | "done" };

export function ThinkingStages({ stages }: { stages: Stage[] }) {
  if (stages.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 rounded-2xl bg-white/70 px-4 py-3 text-sm shadow-sm">
      {stages.map((stage) => (
        <div key={stage.tool} className="flex items-center gap-2">
          <span className="text-[#034F46]">{stage.status === "done" ? "✓" : "…"}</span>
          <span
            className={
              stage.status === "done" ? "text-[#034F46]/50" : "font-medium text-[#034F46]"
            }
          >
            {stage.label}
          </span>
        </div>
      ))}
    </div>
  );
}
