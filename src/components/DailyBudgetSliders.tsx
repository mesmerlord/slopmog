import { CREDIT_COSTS } from "@/constants/credits";
import type { DailyBudget } from "@/services/budget/config";

interface DailyBudgetSlidersProps {
  value: DailyBudget;
  onChange: (budget: DailyBudget) => void;
  perPlatformStats?: Record<string, { posted: number; limit: number }>;
}

const PLATFORMS: Array<{
  key: keyof DailyBudget;
  label: string;
  max: number;
  step: number;
  creditCost: number;
}> = [
  { key: "reddit", label: "Reddit", max: 20, step: 1, creditCost: CREDIT_COSTS.daily.reddit },
  { key: "youtube", label: "YouTube", max: 20, step: 1, creditCost: CREDIT_COSTS.daily.youtube },
  { key: "twitter", label: "Twitter", max: 50, step: 1, creditCost: CREDIT_COSTS.daily.twitter },
];

export default function DailyBudgetSliders({ value, onChange, perPlatformStats }: DailyBudgetSlidersProps) {
  const totalDailyCost =
    value.reddit * CREDIT_COSTS.daily.reddit +
    value.youtube * CREDIT_COSTS.daily.youtube +
    value.twitter * CREDIT_COSTS.daily.twitter;

  return (
    <div className="space-y-4">
      {PLATFORMS.map((p) => {
        const stats = perPlatformStats?.[p.key.toUpperCase()];
        return (
          <div key={p.key}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-charcoal">{p.label}</span>
                <span className="text-[11px] text-charcoal-light">
                  {p.creditCost} credits each
                </span>
              </div>
              <span className="text-sm font-bold text-charcoal tabular-nums w-8 text-right">
                {value[p.key]}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={p.max}
              step={p.step}
              value={value[p.key]}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                onChange({ ...value, [p.key]: val });
              }}
              className="w-full h-1.5 accent-teal cursor-pointer"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-charcoal-light/60">0</span>
              {stats && (
                <span className="text-[10px] text-charcoal-light">
                  {stats.posted} / {stats.limit} today
                </span>
              )}
              <span className="text-[10px] text-charcoal-light/60">{p.max}</span>
            </div>
            {/* Progress bar */}
            {stats && stats.limit > 0 && (
              <div className="mt-1 h-1 rounded-full bg-charcoal/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full bg-teal transition-all"
                  style={{ width: `${Math.min(100, (stats.posted / stats.limit) * 100)}%` }}
                />
              </div>
            )}
          </div>
        );
      })}

      <div className="pt-3 border-t border-charcoal/[0.06]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-charcoal-light">
            Max daily spend
          </span>
          <span className="text-sm font-bold text-charcoal tabular-nums">
            {totalDailyCost} credits/day
          </span>
        </div>
      </div>
    </div>
  );
}
