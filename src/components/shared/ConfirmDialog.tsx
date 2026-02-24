import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  variant?: "danger" | "default";
}

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  variant = "default",
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-charcoal/40 backdrop-blur-sm z-[1000] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[1001] w-[calc(100%-2rem)] max-w-md bg-white rounded-brand shadow-brand-lg p-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          <div className="flex items-start justify-between mb-4">
            <Dialog.Title className="font-heading text-lg font-bold text-charcoal">
              {title}
            </Dialog.Title>
            <Dialog.Close className="text-charcoal-light hover:text-charcoal transition-colors rounded-brand-sm p-1 -m-1">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="text-sm text-charcoal-light mb-6">
            {description}
          </Dialog.Description>
          <div className="flex items-center justify-end gap-3">
            <Dialog.Close className="px-5 py-2 rounded-full text-sm font-bold border border-charcoal/[0.15] text-charcoal hover:bg-charcoal/[0.04] transition-colors">
              {cancelLabel}
            </Dialog.Close>
            <button
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
              className={`px-5 py-2 rounded-full text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                variant === "danger"
                  ? "bg-coral hover:bg-coral-dark"
                  : "bg-teal hover:bg-teal-dark"
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
