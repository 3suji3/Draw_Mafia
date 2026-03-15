"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui";

type RuleGuideModalProps = {
  open: boolean;
  onOpenChange: (nextOpen: boolean) => void;
};

const RULE_SECTIONS = [
  "플레이어 중 1명은 마피아, 나머지는 시민입니다.",
  "시민은 '행동 + 피사체' 형태의 완성형 제시어를 받습니다. (예: 운전하는 자동차)",
  "마피아는 시민 제시어와 헷갈릴 수 있도록 유사하지만 다른 완성형 제시어를 받습니다. (예: 조종하는 비행기)",
  "각 플레이어는 자기 턴에 본인의 제시어를 그림으로 표현합니다.",
  "다른 플레이어는 그림이 그려지는 과정을 실시간으로 볼 수 있습니다.",
  "모든 생존 플레이어가 그림을 마치면 투표 단계로 이동합니다.",
  "투표는 최대 60초이며, 모든 플레이어가 투표를 완료하면 즉시 다음 단계로 넘어갑니다.",
  "채팅은 대기방(waiting)과 투표 단계(voting)에서만 가능합니다. 그림 그리는 단계에서는 채팅이 비활성화됩니다.",
  "시민이 마피아를 탈락시키면, 마피아는 시민 제시어를 맞힐 마지막 기회(20초)를 얻습니다.",
  "마피아가 시민 제시어를 맞추지 못하면 시민 승리입니다.",
  "마피아가 시민 제시어를 맞추면 마피아 역전 승리입니다.",
  "시민과 마피아가 1대1이 되면 마피아 승리입니다.",
] as const;

export function RuleGuideModal({ open, onOpenChange }: RuleGuideModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dm-dialog-overlay fixed inset-0 bg-dm-bg/70 backdrop-blur-sm" />
        <Dialog.Content className="dm-dialog-content fixed left-1/2 top-1/2 w-[94vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-dm-border/80 bg-dm-card/95 p-4 shadow-dm-soft outline-none sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-xl font-bold tracking-tight text-dm-text-primary">
                그림마피아 게임 방법
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-dm-text-secondary">
                처음 플레이하는 유저를 위한 빠른 규칙 안내
              </Dialog.Description>
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                className="inline-flex h-9 w-9 min-w-0 items-center justify-center rounded-lg border border-dm-border bg-dm-muted text-sm font-semibold text-dm-text-secondary transition hover:bg-dm-primary/10 hover:text-dm-primary"
                aria-label="룰 설명 닫기"
              >
                X
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-4 max-h-[60vh] space-y-3 overflow-y-auto pr-1 sm:max-h-[65vh]">
            <CardLike>
              <p className="text-sm font-semibold text-dm-text-primary">제시어 예시</p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-dm-primary/30 bg-dm-primary/10 p-3">
                  <p className="text-xs font-semibold text-dm-primary">시민</p>
                  <p className="mt-1 text-sm font-semibold text-dm-text-primary">운전하는 자동차</p>
                </div>
                <div className="rounded-xl border border-dm-accent/30 bg-dm-accent/10 p-3">
                  <p className="text-xs font-semibold text-dm-accent">마피아</p>
                  <p className="mt-1 text-sm font-semibold text-dm-text-primary">조종하는 비행기</p>
                </div>
              </div>
            </CardLike>

            {RULE_SECTIONS.map((section, index) => (
              <CardLike key={section}>
                <p className="text-xs font-semibold text-dm-accent">규칙 {index + 1}</p>
                <p className="mt-1 text-sm leading-6 text-dm-text-primary">{section}</p>
              </CardLike>
            ))}
          </div>

          <div className="mt-4 flex justify-end">
            <Dialog.Close asChild>
              <Button type="button" variant="primary" className="min-w-[120px]">
                닫기
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type CardLikeProps = {
  children: React.ReactNode;
};

function CardLike({ children }: CardLikeProps) {
  return (
    <section className="rounded-xl border border-dm-border bg-dm-muted/70 p-3 sm:p-4">
      {children}
    </section>
  );
}
