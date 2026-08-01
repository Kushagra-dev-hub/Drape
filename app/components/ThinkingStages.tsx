import { SparkleIcon, CheckCircleIcon } from "./icons";

export type Stage = { tool: string; label: string; status: "active" | "done" };

export function ThinkingStages({ stages }: { stages: Stage[] }) {
  if (stages.length === 0) return null;

  return (
    <div className="glass-card animate-fade-in flex flex-col gap-2 rounded-2xl px-5 py-4 text-sm">
      <div className="mb-0.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[--color-text-tertiary]">
        <SparkleIcon className="h-3.5 w-3.5 animate-pulse-dot" />
        Thinking
      </div>
      {stages.map((stage) => (
        <div
          key={stage.tool}
          className={`flex items-center gap-2.5 transition-opacity duration-300 ${
            stage.status === "done" ? "opacity-50" : "opacity-100"
          }`}
        >
          {stage.status === "done" ? (
            <CheckCircleIcon className="h-4 w-4 text-[--color-success] animate-scale-in" />
          ) : (
            <span className="flex h-4 w-4 items-center justify-center">
              <span className="h-2 w-2 rounded-full bg-[--color-primary-muted] animate-pulse-dot" />
            </span>
          )}
          <span
            className={
              stage.status === "done"
                ? "text-[--color-text-secondary]"
                : "font-medium text-[--color-text]"
            }
          >
            {stage.label}
          </span>
        </div>
      ))}
    </div>
  );
}
