"use client";

import * as Dialog from "@radix-ui/react-dialog";

type GameDialogProps = {
  open: boolean;
  title: string;
  description: string;
  onOpenChange: (nextOpen: boolean) => void;
};

export function GameDialog({
  open,
  title,
  description,
  onOpenChange,
}: GameDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-slate-950/45" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-6 shadow-xl outline-none">
          <Dialog.Title className="text-lg font-semibold text-slate-900">
            {title}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-slate-600">
            {description}
          </Dialog.Description>
          <div className="mt-5 flex justify-end">
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                확인
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
