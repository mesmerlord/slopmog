import { useState, useCallback } from "react";
import type { GetServerSideProps } from "next";
import { toast } from "sonner";
import {
  Inbox,
  Check,
  X,
  Pencil,
  ExternalLink,
} from "lucide-react";
import Seo from "@/components/Seo";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { trpc } from "@/utils/trpc";
import { routes } from "@/lib/constants";
import { getServerAuthSession } from "@/server/utils/auth";

function PlatformBadge({ platform }: { platform: string }) {
  const colors = platform === "REDDIT"
    ? "bg-orange-100 text-orange-700"
    : "bg-red-100 text-red-700";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${colors}`}>
      {platform === "REDDIT" ? "Reddit" : "YouTube"}
    </span>
  );
}

interface QueueItemProps {
  opportunity: {
    id: string;
    title: string;
    contentUrl: string;
    platform: string;
    sourceContext: string;
    relevanceScore: number;
    matchedKeyword: string;
    site: { id: string; name: string; url: string };
    comments: Array<{ id: string; text: string; qualityScore: number; persona: string }>;
  };
  onApprove: (commentId: string) => void;
  onSkip: (commentId: string) => void;
  onEdit: (commentId: string, text: string) => void;
  isActing: boolean;
}

function QueueItem({ opportunity, onApprove, onSkip, onEdit, isActing }: QueueItemProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const comment = opportunity.comments[0];

  if (!comment) return null;

  const handleStartEdit = () => {
    setEditText(comment.text);
    setEditing(true);
  };

  const handleSaveEdit = () => {
    onEdit(comment.id, editText);
    setEditing(false);
  };

  return (
    <div className="bg-white rounded-brand shadow-brand-sm border border-charcoal/[0.06] p-5 min-h-[280px] flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <PlatformBadge platform={opportunity.platform} />
            <span className="text-xs text-charcoal-light">{opportunity.sourceContext}</span>
            <span className="text-xs text-charcoal-light/50">|</span>
            <span className="text-xs text-charcoal-light">
              Score: {(opportunity.relevanceScore * 100).toFixed(0)}%
            </span>
          </div>
          <a
            href={opportunity.contentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-heading font-bold text-charcoal hover:text-teal transition-colors text-base flex items-center gap-1 line-clamp-1"
          >
            <span className="truncate">{opportunity.title}</span>
            <ExternalLink size={14} className="shrink-0 text-charcoal-light" />
          </a>
          <p className="text-xs text-charcoal-light mt-0.5">
            Keyword: <span className="font-semibold">{opportunity.matchedKeyword}</span>
            {" | "}Site: {opportunity.site.name}
          </p>
        </div>
      </div>

      {/* Comment */}
      <div className="bg-charcoal/[0.02] rounded-brand-sm border border-charcoal/[0.06] p-4 mb-4 flex-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-charcoal-light uppercase">
            Generated Comment ({comment.persona})
          </span>
          <span className="text-xs text-charcoal-light">
            Quality: {(comment.qualityScore * 100).toFixed(0)}%
          </span>
        </div>
        {editing ? (
          <div>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full p-3 rounded-brand-sm border border-charcoal/[0.12] bg-white text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-teal/30 resize-y min-h-[80px]"
              rows={4}
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleSaveEdit}
                className="px-3 py-1.5 bg-teal text-white rounded-full text-xs font-bold hover:bg-teal-dark transition-all"
              >
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-3 py-1.5 border border-charcoal/[0.1] text-charcoal-light rounded-full text-xs font-bold hover:bg-charcoal/[0.04] transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-charcoal whitespace-pre-wrap line-clamp-6">{comment.text}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onApprove(comment.id)}
          disabled={isActing}
          className="inline-flex items-center gap-1.5 bg-teal text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-teal-dark transition-all disabled:opacity-50"
        >
          <Check size={14} />
          Approve
        </button>
        {!editing && (
          <button
            onClick={handleStartEdit}
            className="inline-flex items-center gap-1.5 border border-charcoal/[0.12] text-charcoal px-4 py-2 rounded-full text-sm font-bold hover:bg-charcoal/[0.04] transition-all"
          >
            <Pencil size={14} />
            Edit
          </button>
        )}
        <button
          onClick={() => onSkip(comment.id)}
          disabled={isActing}
          className="inline-flex items-center gap-1.5 border border-coral/30 text-coral px-4 py-2 rounded-full text-sm font-bold hover:bg-coral/5 transition-all disabled:opacity-50"
        >
          <X size={14} />
          Skip
        </button>
      </div>
    </div>
  );
}

export default function QueuePage() {
  const utils = trpc.useUtils();
  const [actingOn, setActingOn] = useState<string | null>(null);

  const pendingQuery = trpc.opportunity.listPending.useQuery({ limit: 20 });

  const approveMutation = trpc.comment.approve.useMutation({
    onSuccess: () => {
      toast.success("Comment approved and queued for posting!");
      utils.opportunity.listPending.invalidate();
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setActingOn(null),
  });

  const skipMutation = trpc.comment.skip.useMutation({
    onSuccess: () => {
      toast.success("Skipped.");
      utils.opportunity.listPending.invalidate();
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setActingOn(null),
  });

  const editMutation = trpc.comment.edit.useMutation({
    onSuccess: () => {
      toast.success("Comment updated.");
      utils.opportunity.listPending.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <DashboardLayout>
      <Seo title="Queue -- SlopMog" noIndex />

      <PageHeader
        title="Review Queue"
        description="Approve, edit, or skip discovered opportunities"
        breadcrumbs={[
          { label: "Dashboard", href: routes.dashboard.index },
          { label: "Queue" },
        ]}
      />

      {pendingQuery.isLoading ? (
        <LoadingState variant="spinner" text="Loading queue..." />
      ) : !pendingQuery.data?.items.length ? (
        <EmptyState
          icon={Inbox}
          title="Queue is clear"
          description="No opportunities waiting for review. Run discovery on a site to find new ones."
          actionLabel="View Sites"
          href={routes.dashboard.sites.index}
        />
      ) : (
        <div className="space-y-4">
          {pendingQuery.data.items.map((opp) => (
            <QueueItem
              key={opp.id}
              opportunity={opp}
              onApprove={(commentId) => {
                setActingOn(commentId);
                approveMutation.mutate({ commentId });
              }}
              onSkip={(commentId) => {
                setActingOn(commentId);
                skipMutation.mutate({ commentId });
              }}
              onEdit={(commentId, text) => {
                editMutation.mutate({ commentId, text });
              }}
              isActing={actingOn !== null}
            />
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerAuthSession(ctx);

  if (!session) {
    return {
      redirect: {
        destination: `/auth/login?callbackUrl=${encodeURIComponent(ctx.resolvedUrl)}`,
        permanent: false,
      },
    };
  }

  return { props: {} };
};
