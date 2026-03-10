import { useState, useEffect } from "react";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { SlidersHorizontal, X, Loader2, RotateCcw } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { DISCOVERY_DEFAULTS, type DiscoveryConfig } from "@/services/discovery/config";

type SettingsField = {
  key: keyof DiscoveryConfig;
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
};

const SETTINGS_FIELDS: SettingsField[] = [
  { key: "minRedditUpvotes", label: "Min Reddit Upvotes", description: "Skip posts below this upvote count", min: 0, max: 100, step: 1 },
  { key: "minRedditComments", label: "Min Reddit Comments", description: "Posts also pass if they have this many comments", min: 0, max: 100, step: 1 },
  { key: "minSubredditSubscribers", label: "Min Subreddit Subscribers", description: "Skip tiny subreddits", min: 0, max: 1_000_000, step: 1000 },
  { key: "minYoutubeViews", label: "Min YouTube Views", description: "Skip low-view videos", min: 0, max: 1_000_000, step: 100 },
  { key: "maxYoutubeAgeDays", label: "Max YouTube Age (days)", description: "Ignore videos older than this", min: 1, max: 365, step: 1 },
  { key: "maxRedditPages", label: "Max Reddit Pages", description: "Pages to scrape per keyword", min: 1, max: 20, step: 1 },
  { key: "dailyKeywordLimit", label: "Daily Keyword Limit", description: "How many keywords to search per discovery run", min: 1, max: 30, step: 1 },
  { key: "hvQueryCount", label: "HV Query Count", description: "Queries to generate per HV discovery run", min: 5, max: 100, step: 5 },
  { key: "autoGenerateTopN", label: "Auto-Generate Top N", description: "Auto-generate comments for top N opportunities", min: 0, max: 50, step: 1 },
  { key: "autoGenerateMinScore", label: "Auto-Generate Min Score", description: "Min relevance score to auto-generate (0-1)", min: 0, max: 1, step: 0.05 },
  { key: "maxTrackedProfiles", label: "Twitter Accounts to Track", description: "How many X/Twitter profiles to discover and follow", min: 5, max: 50, step: 1 },
  { key: "twitterTweetsPerProfile", label: "Tweets per Profile", description: "How many recent tweets to scrape per tracked profile", min: 5, max: 50, step: 1 },
];

function formatFieldValue(key: keyof DiscoveryConfig, value: number): string {
  if (key === "minSubredditSubscribers") return value >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(value);
  if (key === "autoGenerateMinScore") return value.toFixed(2);
  return String(value);
}

/**
 * Two modes:
 * - "persisted": loads/saves config from the DB via siteId (for existing sites)
 * - "local": manages config in local state, calls onSave with the draft (for new site creation)
 */
type DiscoverySettingsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & (
  | { mode: "persisted"; siteId: string; initialConfig?: never; onSave?: never }
  | { mode: "local"; siteId?: never; initialConfig: DiscoveryConfig; onSave: (config: DiscoveryConfig) => void }
);

export default function DiscoverySettingsModal(props: DiscoverySettingsModalProps) {
  const { open, onOpenChange } = props;
  const [draft, setDraft] = useState<DiscoveryConfig>(
    props.mode === "local" ? props.initialConfig : DISCOVERY_DEFAULTS,
  );
  const utils = trpc.useUtils();

  // ── Persisted mode: fetch from DB ──
  const configQuery = trpc.site.getDiscoveryConfig.useQuery(
    { siteId: props.mode === "persisted" ? props.siteId : "" },
    { enabled: open && props.mode === "persisted" },
  );

  const updateConfig = trpc.site.updateDiscoveryConfig.useMutation({
    onSuccess: () => {
      toast.success("Discovery settings saved!");
      if (props.mode === "persisted") {
        utils.site.getDiscoveryConfig.invalidate({ siteId: props.siteId });
      }
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  // Sync draft when query loads (persisted) or initialConfig changes (local)
  useEffect(() => {
    if (props.mode === "persisted" && configQuery.data) {
      setDraft(configQuery.data.config);
    }
  }, [props.mode, configQuery.data]);

  useEffect(() => {
    if (props.mode === "local" && open) {
      setDraft(props.initialConfig);
    }
  }, [props.mode, open, props.mode === "local" ? props.initialConfig : null]);

  const baseConfig = props.mode === "persisted" ? configQuery.data?.config : props.initialConfig;
  const hasChanges = baseConfig
    ? SETTINGS_FIELDS.some((f) => draft[f.key] !== baseConfig[f.key])
    : false;

  const isDefault = SETTINGS_FIELDS.every((f) => draft[f.key] === DISCOVERY_DEFAULTS[f.key]);
  const isLoading = props.mode === "persisted" && configQuery.isLoading;

  const handleSave = () => {
    if (props.mode === "persisted") {
      updateConfig.mutate({ siteId: props.siteId, config: draft });
    } else {
      props.onSave(draft);
      onOpenChange(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-charcoal/40 backdrop-blur-sm z-[1000] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[1001] w-[calc(100%-2rem)] max-w-lg bg-white rounded-brand shadow-brand-lg p-6 max-h-[85vh] overflow-y-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          <div className="flex items-start justify-between mb-5">
            <div>
              <Dialog.Title className="font-heading text-lg font-bold text-charcoal flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-teal" />
                Discovery Settings
              </Dialog.Title>
              <Dialog.Description className="text-sm text-charcoal-light mt-1">
                Tune how aggressively we filter Reddit, YouTube, and Twitter results.
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
            <div className="space-y-4">
              {SETTINGS_FIELDS.map((field) => (
                <div key={field.key} className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-charcoal">{field.label}</p>
                    <p className="text-[11px] text-charcoal-light">{field.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-charcoal-light w-10 text-right tabular-nums">
                      {formatFieldValue(field.key, draft[field.key])}
                    </span>
                    <input
                      type="range"
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={draft[field.key]}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setDraft((prev) => ({ ...prev, [field.key]: val }));
                      }}
                      className="w-28 h-1.5 accent-teal cursor-pointer"
                    />
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between pt-4 border-t border-charcoal/[0.06]">
                <button
                  type="button"
                  onClick={() => setDraft({ ...DISCOVERY_DEFAULTS })}
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
                    disabled={!hasChanges || updateConfig.isPending}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white bg-teal hover:bg-teal-dark transition-all disabled:opacity-40"
                  >
                    {updateConfig.isPending && <Loader2 size={12} className="animate-spin" />}
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
