import { Coins } from "lucide-react";
import { trpc } from "@/utils/trpc";

interface CreditBalanceProps {
  className?: string;
  compact?: boolean;
}

export default function CreditBalance({
  className = "",
  compact = false,
}: CreditBalanceProps) {
  const { data, isLoading } = trpc.user.getCredits.useQuery();

  const displayValue = isLoading ? "..." : (data?.amount ?? 0).toLocaleString();

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 text-sm font-bold text-charcoal ${className}`}>
        <Coins className="w-4 h-4 text-sunny-dark" strokeWidth={2} />
        {displayValue}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sunny/20 text-sm font-bold text-charcoal ${className}`}
    >
      <Coins className="w-4 h-4 text-sunny-dark" strokeWidth={2} />
      {displayValue}
    </span>
  );
}
