import { useState, useEffect } from "react";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { Settings, X, Loader2, RotateCcw, AlertCircle } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { DAILY_BUDGET_DEFAULTS, parseDailyBudget, type DailyBudget } from "@/services/budget/config";
import { CREDIT_COSTS } from "@/constants/credits";
import DailyBudgetSliders from "./DailyBudgetSliders";

function computeDailyCost(budget: DailyBudget): number {
  return (
    budget.reddit * CREDIT_COSTS.daily.reddit +
    budget.youtube * CREDIT_COSTS.daily.youtube +
    budget.twitter * CREDIT_COSTS.daily.twitter
  );
}

type DailyBudgetModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsufficientCredits?: () => void;
} & (
  | { mode: "persisted"; siteId: string; initialBudget?: never; onSave?: (budget: DailyBudget) => void }
  | { mode: "local"; siteId?: never; initialBudget: DailyBudget; onSave: (budget: DailyBudget) => void }
);

export default function DailyBudgetModal(props: DailyBudgetModalProps) {
  const { open, onOpenChange } = props;
  const [draft, setDraft] = useState<DailyBudget>(
    props.mode === "local" ? props.initialBudget : DAILY_BUDGET_DEFAULTS,
  );
  const utils = trpc.useUtils();

  // Persisted mode: fetch current budget from the site query
  const siteQuery = trpc.site.getById.useQuery(
    { id: props.mode === "persisted" ? props.siteId : "" },
    { enabled: open && props.mode === "persisted" },
  );

  // Fetch credits for the gate check
  const autoStatsQuery = trpc.site.getDailyAutoStats.useQuery(
    { siteId: props.mode === "persisted" ? props.siteId : "" },
    { enabled: open && props.mode === "persisted" },
  );

  // For local mode (site creation), get plan info
  const planQuery = trpc.user.getPlanInfo.useQuery(undefined, {
    enabled: open && props.mode === "local",
  });

  const updateSite = trpc.site.update.useMutation({
    onSuccess: () => {
      toast.success("Daily budget saved!");
      if (props.mode === "persisted") {
        utils.site.getById.invalidate({ id: props.siteId });
        utils.site.getDailyAutoStats.invalidate({ siteId: props.siteId });
      }
      if (props.onSave) props.onSave(draft);
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  // Sync draft when site data loads (persisted) or initialBudget changes (local)
  useEffect(() => {
    if (props.mode === "persisted" && siteQuery.data) {
      setDraft(parseDailyBudget(siteQuery.data.dailyBudget));
    }
  }, [props.mode, siteQuery.data]);

  useEffect(() => {
    if (props.mode === "local" && open) {
      setDraft(props.initialBudget);
    }
  }, [props.mode, open, props.mode === "local" ? props.initialBudget : null]);

  const baseConfig = props.mode === "persisted" && siteQuery.data
    ? parseDailyBudget(siteQuery.data.dailyBudget)
    : props.mode === "local" ? props.initialBudget : DAILY_BUDGET_DEFAULTS;

  const hasChanges =
    draft.reddit !== baseConfig.reddit ||
    draft.youtube !== baseConfig.youtube ||
    draft.twitter !== baseConfig.twitter;

  const isDefault =
    draft.reddit === DAILY_BUDGET_DEFAULTS.reddit &&
    draft.youtube === DAILY_BUDGET_DEFAULTS.youtube &&
    draft.twitter === DAILY_BUDGET_DEFAULTS.twitter;

  const isLoading = props.mode === "persisted" && siteQuery.isLoading;

  // Credit check
  const dailyCost = computeDailyCost(draft);
  const totalCredits = props.mode === "persisted"
    ? autoStatsQuery.data?.totalCredits
    : undefined; // local mode doesn't have credits context yet
  const hasInsufficientCredits = totalCredits !== undefined && dailyCost > 0 && totalCredits < dailyCost;
  const hasZeroCredits = totalCredits !== undefined && totalCredits <= 0 && dailyCost > 0;
  const isPaidPlan = props.mode === "local" ? (planQuery.data?.isPaid ?? false) : true; // persisted = already has a site = likely paid

  const handleSave = () => {
    // Block save if user can't afford the budget and show upgrade modal
    if (hasZeroCredits || (hasInsufficientCredits && props.onInsufficientCredits)) {
      if (props.onInsufficientCredits) {
        props.onInsufficientCredits();
        onOpenChange(false);
      }
      return;
    }

    if (props.mode === "persisted") {
      updateSite.mutate({ id: props.siteId, dailyBudget: draft });
    } else {
      props.onSave(draft);
      onOpenChange(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-charcoal/40 backdrop-blur-sm z-[1000] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[1001] w-[calc(100%-2rem)] max-w-md bg-white rounded-brand shadow-brand-lg p-6 max-h-[85vh] overflow-y-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          <div className="flex items-start justify-between mb-5">
            <div>
              <Dialog.Title className="font-heading text-lg font-bold text-charcoal flex items-center gap-2">
                <Settings size={18} className="text-teal" />
                Daily Budget
              </Dialog.Title>
              <Dialog.Description className="text-sm text-charcoal-light mt-1">
                Set how many comments to auto-post per platform each day.
              </Dialog.Description>
            </div>
            <Dialog.Close className="text-charcoal-light hover:text-charcoal transition-colors rounded-brand-sm p-1 -m-1">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-teal" />
            </div>
          ) : (
            <>
              <DailyBudgetSliders value={draft} onChange={setDraft} />

              {/* Credit warning */}
              {hasZeroCredits && (
                <div className="mt-4 flex items-start gap-2 bg-coral/[0.06] border border-coral/20 rounded-brand px-4 py-3">
                  <AlertCircle size={16} className="text-coral flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-charcoal">
                    You have no credits. Buy credits or upgrade your plan to use auto mode.
                  </p>
                </div>
              )}
              {hasInsufficientCredits && !hasZeroCredits && (
                <div className="mt-4 flex items-start gap-2 bg-sunny/[0.08] border border-sunny/20 rounded-brand px-4 py-3">
                  <AlertCircle size={16} className="text-sunny-dark flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-charcoal">
                    This budget costs {dailyCost} credits/day but you only have {totalCredits}. Auto-posting will stop early.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 mt-4 border-t border-charcoal/[0.06]">
                <button
                  type="button"
                  onClick={() => setDraft({ ...DAILY_BUDGET_DEFAULTS })}
                  disabled={isDefault}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-charcoal-light hover:text-charcoal transition-colors disabled:opacity-30"
                >
                  <RotateCcw size={12} />
                  Reset to Defaults
                </button>
                <div className="flex items-center gap-2">
                  <Dialog.Close className="px-4 py-2 rounded-full text-xs font-bold border border-charcoal/[0.15] text-charcoal hover:bg-charcoal/[0.04] transition-colors">
                    Cancel
                  </Dialog.Close>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={(!hasChanges && !hasZeroCredits) || updateSite.isPending}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all disabled:opacity-40 ${
                      hasZeroCredits
                        ? "text-white bg-coral hover:bg-coral-dark"
                        : "text-white bg-teal hover:bg-teal-dark"
                    }`}
                  >
                    {updateSite.isPending && <Loader2 size={12} className="animate-spin" />}
                    {hasZeroCredits ? "Get Credits" : "Save"}
                  </button>
                </div>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
