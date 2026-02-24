import { useEffect, useState } from "react";
import { Loader2, Search, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";

interface DiscoveryProgress {
  stage: string;
  message: string;
  currentSubreddit?: string;
  threadsFound: number;
  threadsScored: number;
  opportunitiesCreated: number;
  startedAt: string;
  updatedAt: string;
}

interface DiscoveryProgressCardProps {
  progress: DiscoveryProgress;
}

function formatElapsed(startedAt: string): string {
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const seconds = Math.floor((now - start) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

export default function DiscoveryProgressCard({ progress }: DiscoveryProgressCardProps) {
  const [elapsed, setElapsed] = useState(formatElapsed(progress.startedAt));

  useEffect(() => {
    if (progress.stage === "complete" || progress.stage === "error") return;
    const interval = setInterval(() => {
      setElapsed(formatElapsed(progress.startedAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [progress.startedAt, progress.stage]);

  const isActive = progress.stage !== "complete" && progress.stage !== "error";
  const isComplete = progress.stage === "complete";
  const isError = progress.stage === "error";

  const StageIcon = isError
    ? AlertCircle
    : isComplete
      ? CheckCircle2
      : progress.stage === "scoring"
        ? Sparkles
        : progress.stage === "scanning"
          ? Search
          : Loader2;

  const iconColor = isError
    ? "text-coral"
    : isComplete
      ? "text-teal"
      : "text-teal";

  return (
    <div className={`rounded-brand border p-4 mb-6 transition-all ${
      isActive
        ? "bg-teal/[0.04] border-teal/20"
        : isError
          ? "bg-coral/[0.04] border-coral/20"
          : "bg-teal/[0.04] border-teal/10"
    }`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="mt-0.5">
          <StageIcon
            size={20}
            className={`${iconColor} ${isActive ? "animate-spin" : ""}`}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-charcoal">
              {isActive ? "Discovery in progress" : isComplete ? "Discovery complete" : "Discovery failed"}
            </span>
            {isActive && (
              <span className="text-[0.7rem] font-medium text-charcoal-light">
                {elapsed}
              </span>
            )}
          </div>

          <p className="text-[0.82rem] text-charcoal-light mb-2">
            {progress.message}
          </p>

          {/* Counters */}
          <div className="flex items-center gap-4">
            {progress.threadsFound > 0 && (
              <div className="flex items-center gap-1.5">
                <Search size={12} className="text-charcoal-light" />
                <span className="text-[0.75rem] font-semibold text-charcoal-light">
                  {progress.threadsFound} threads found
                </span>
              </div>
            )}
            {progress.opportunitiesCreated > 0 && (
              <div className="flex items-center gap-1.5">
                <Sparkles size={12} className="text-teal" />
                <span className="text-[0.75rem] font-semibold text-teal-dark">
                  {progress.opportunitiesCreated} opportunities
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
