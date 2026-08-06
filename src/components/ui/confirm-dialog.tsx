import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  isPending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg"
        onClick={(event) => event.stopPropagation()}>
        <h2 id="confirm-dialog-title" className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        {description && <p className="mt-2 text-sm text-slate-600">{description}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isPending}>
            {cancelLabel}
          </Button>
          <Button ref={confirmRef} variant="destructive" onClick={onConfirm} disabled={isPending}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export { ConfirmDialog };
export type { ConfirmDialogProps };
