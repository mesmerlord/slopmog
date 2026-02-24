import Link from "next/link";
import { Inbox, type LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  href?: string;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  href,
}: EmptyStateProps) {
  const DisplayIcon = Icon || Inbox;

  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-12 bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06]">
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-teal/10 mb-4">
        <DisplayIcon className="w-6 h-6 text-teal" strokeWidth={1.8} />
      </div>
      <h3 className="font-heading text-lg font-bold text-charcoal mb-1">
        {title}
      </h3>
      <p className="text-sm text-charcoal-light max-w-sm mb-5">
        {description}
      </p>
      {actionLabel && href && (
        <Link
          href={href}
          className="inline-flex items-center justify-center bg-coral text-white px-6 py-2.5 rounded-full font-bold text-sm hover:bg-coral-dark hover:-translate-y-0.5 hover:shadow-lg transition-all"
        >
          {actionLabel}
        </Link>
      )}
      {actionLabel && onAction && !href && (
        <button
          onClick={onAction}
          className="inline-flex items-center justify-center bg-coral text-white px-6 py-2.5 rounded-full font-bold text-sm hover:bg-coral-dark hover:-translate-y-0.5 hover:shadow-lg transition-all"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
