import { AlertTriangle, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { trpc } from "@/utils/trpc";

export default function ImpersonationBanner() {
  const { data: session } = useSession();
  const utils = trpc.useUtils();

  const { data: impersonationStatus } = trpc.user.getImpersonationStatus.useQuery(
    undefined,
    {
      enabled: !!session?.user && session.user.role === "ADMIN",
      refetchInterval: 30000,
    },
  );

  const stopImpersonation = trpc.admin.stopImpersonation.useMutation({
    onSuccess: () => {
      toast.success("Stopped impersonating user");
      utils.invalidate();
      window.location.reload();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (!impersonationStatus?.isImpersonating) return null;

  const userName = impersonationStatus.targetUserName || "Unknown";
  const userEmail = impersonationStatus.targetUserEmail || "";

  return (
    <div className="sticky top-0 z-[100] bg-amber-500 text-amber-950 px-4 py-2 shadow-brand-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <AlertTriangle size={18} className="flex-shrink-0" />
          <span className="text-sm font-body font-semibold truncate">
            Viewing as:{" "}
            <strong className="font-bold">
              {userName} ({userEmail})
            </strong>
          </span>
        </div>
        <button
          onClick={() => stopImpersonation.mutate()}
          disabled={stopImpersonation.isPending}
          className="inline-flex items-center gap-1.5 rounded-full bg-amber-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex-shrink-0"
        >
          {stopImpersonation.isPending ? (
            "Stopping..."
          ) : (
            <>
              <X size={14} />
              Stop Impersonating
            </>
          )}
        </button>
      </div>
    </div>
  );
}
