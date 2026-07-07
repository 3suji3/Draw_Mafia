"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui";

type RuleGuideModalProps = {
  open: boolean;
  onOpenChange: (nextOpen: boolean) => void;
};

const QUICK_FLOW = ["역할 배정", "그림 그리기", "투표", "결과 공개"] as const;

const RULE_GROUPS = [
  {
    title: "기본 규칙",
    accent: "text-dm-primary",
    border: "border-dm-primary/25",
    items: [
      "플레이어 중 1명은 마피아, 나머지는 시민입니다.",
      "시민/마피아 모두 완성형 제시어를 받습니다. (행동 + 피사체)",
      "시민 예시: 운전하는 자동차 / 마피아 예시: 조종하는 비행기",
    ],
  },
  {
    title: "라운드 진행",
    accent: "text-dm-accent",
    border: "border-dm-accent/25",
    items: [
      "각 플레이어는 자기 턴에만 그림을 그릴 수 있습니다.",
      "다른 플레이어는 그리는 과정을 실시간으로 볼 수 있습니다.",
      "모든 생존 플레이어의 그림이 끝나면 자동으로 투표 단계로 이동합니다.",
    ],
  },
  {
    title: "투표 및 채팅",
    accent: "text-emerald-400",
    border: "border-emerald-400/25",
    items: [
      "투표 시간은 최대 60초이며, 전원 투표 시 즉시 종료됩니다.",
      "채팅은 waiting / voting에서만 가능하고, playing에서는 비활성화됩니다.",
      "동률 또는 '넘어가기' 최다 득표면 탈락자는 없습니다.",
    ],
  },
  {
    title: "승리 조건",
    accent: "text-rose-400",
    border: "border-rose-400/25",
    items: [
      "시민이 마피아를 탈락시키면 마피아는 20초 동안 마지막 추측 기회를 얻습니다.",
      "마피아가 시민 제시어를 맞히면 역전 승리, 실패하면 시민 승리입니다.",
      "시민과 마피아 수가 1대1이 되면 즉시 마피아 승리입니다.",
    ],
  },
] as const;

export function RuleGuideModal({ open, onOpenChange }: RuleGuideModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dm-dialog-overlay fixed inset-0 z-50 bg-dm-bg/70 backdrop-blur-sm" />
        <Dialog.Content className="dm-dialog-content fixed left-1/2 top-1/2 z-[60] w-[94vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-dm-border/80 bg-dm-card/95 p-4 shadow-dm-soft outline-none sm:p-6">
          <div className="flex items-start justify-between gap-3 border-b border-dm-border/70 pb-4">
            <div>
              <Dialog.Title className="text-xl font-bold tracking-tight text-dm-text-primary">
                룰 설명
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-dm-text-secondary">
                1분 안에 이해하는 그림마피아 핵심 규칙
              </Dialog.Description>
              <div className="mt-3 inline-flex rounded-full border border-dm-primary/30 bg-dm-primary/10 px-3 py-1 text-xs font-semibold text-dm-primary">
                처음 플레이어 필독
              </div>
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

          <div className="mt-4 max-h-[62vh] space-y-4 overflow-y-auto pr-1 sm:max-h-[66vh]">
            <section className="rounded-xl border border-dm-border bg-dm-muted/70 p-3 sm:p-4">
              <p className="text-xs font-semibold tracking-wide text-dm-text-secondary">빠른 진행 순서</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {QUICK_FLOW.map((step, index) => (
                  <div
                    key={step}
                    className="inline-flex items-center gap-2 rounded-full border border-dm-primary/30 bg-dm-primary/10 px-3 py-1 text-xs font-semibold text-dm-primary"
                  >
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-dm-primary text-[10px] text-white">
                      {index + 1}
                    </span>
                    {step}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-dm-border bg-dm-muted/70 p-3 sm:p-4">
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
            </section>

            {RULE_GROUPS.map((group) => (
              <section key={group.title} className={`rounded-xl border bg-dm-muted/70 p-3 sm:p-4 ${group.border}`}>
                <p className={`text-sm font-semibold ${group.accent}`}>{group.title}</p>
                <ul className="mt-2 space-y-2">
                  {group.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm leading-6 text-dm-text-primary">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-dm-text-secondary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
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
