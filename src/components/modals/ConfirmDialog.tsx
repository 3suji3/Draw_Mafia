"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onOpenChange: (nextOpen: boolean) => void;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "확인",
  cancelLabel = "취소",
  loading = false,
  onOpenChange,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dm-dialog-overlay fixed inset-0 bg-dm-bg/70 backdrop-blur-sm" />
        <Dialog.Content className="dm-dialog-content fixed left-1/2 top-1/2 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-dm-primary/20 bg-dm-card/95 p-6 shadow-dm-soft outline-none">
          <Dialog.Title className="text-lg font-semibold text-dm-text-primary">
            {title}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm font-medium text-dm-text-secondary">
            {description}
          </Dialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" disabled={loading}>
                {cancelLabel}
              </Button>
            </Dialog.Close>
            <Button type="button" variant="secondary" disabled={loading} onClick={() => void onConfirm()}>
              {loading ? "처리 중..." : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
