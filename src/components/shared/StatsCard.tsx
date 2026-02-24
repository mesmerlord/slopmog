import { ArrowUp, ArrowDown, type LucideIcon } from "lucide-react";

interface StatsCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  trend?: { value: number; positive: boolean };
  className?: string;
}

export default function StatsCard({
  icon: Icon,
  value,
  label,
  trend,
  className = "",
}: StatsCardProps) {
  return (
    <div
      className={`bg-white rounded-brand shadow-brand-sm p-5 border border-charcoal/[0.06] ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-teal/10">
          <Icon className="w-5 h-5 text-teal" strokeWidth={1.8} />
        </div>
        {trend && (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
              trend.positive
                ? "bg-teal/10 text-teal-dark"
                : "bg-coral/10 text-coral-dark"
            }`}
          >
            {trend.positive ? (
              <ArrowUp className="w-3 h-3" />
            ) : (
              <ArrowDown className="w-3 h-3" />
            )}
            {trend.value}%
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold font-heading text-charcoal">{value}</p>
        <p className="text-sm text-charcoal-light mt-0.5">{label}</p>
      </div>
    </div>
  );
}
