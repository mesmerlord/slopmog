import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  variant: "spinner" | "skeleton" | "page";
  text?: string;
}

export default function LoadingState({ variant, text }: LoadingStateProps) {
  if (variant === "skeleton") {
    return (
      <div className="w-full space-y-4 animate-pulse">
        <div className="h-4 bg-charcoal/[0.08] rounded-brand-sm w-3/4" />
        <div className="h-4 bg-charcoal/[0.08] rounded-brand-sm w-full" />
        <div className="h-4 bg-charcoal/[0.08] rounded-brand-sm w-5/6" />
      </div>
    );
  }

  if (variant === "page") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 text-teal animate-spin" strokeWidth={2} />
        {text && (
          <p className="mt-3 text-sm text-charcoal-light font-body">{text}</p>
        )}
      </div>
    );
  }

  // spinner (default)
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 className="w-8 h-8 text-teal animate-spin" strokeWidth={2} />
      {text && (
        <p className="mt-3 text-sm text-charcoal-light font-body">{text}</p>
      )}
    </div>
  );
}
