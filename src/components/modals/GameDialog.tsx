"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { Button } from "@/components/ui";

type GameDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  onOpenChange: (nextOpen: boolean) => void;
};

export function GameDialog({
  open,
  title,
  description,
  children,
  footer,
  onOpenChange,
}: GameDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dm-dialog-overlay fixed inset-0 z-50 bg-dm-bg/70 backdrop-blur-sm" />
        <Dialog.Content className="dm-dialog-content fixed left-1/2 top-1/2 z-[60] w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-dm-primary/20 bg-dm-card/95 p-6 shadow-dm-soft outline-none">
          <Dialog.Title className="text-lg font-semibold text-dm-text-primary">
            {title}
          </Dialog.Title>
          {children ? (
            <div className="mt-2 space-y-2 text-sm font-medium text-dm-text-secondary">
              {children}
            </div>
          ) : (
            <Dialog.Description className="mt-2 text-sm font-medium text-dm-text-secondary">
              {description}
            </Dialog.Description>
          )}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            {footer ?? (
              <Dialog.Close asChild>
                <Button variant="primary">
                  확인
                </Button>
              </Dialog.Close>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
