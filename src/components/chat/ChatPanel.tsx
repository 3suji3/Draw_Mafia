"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@/hooks/useChat";
import { CHAT_EMOJI_LIST, CHAT_MAX_LENGTH } from "@/types/chat";

const TABLET_MEDIA_QUERY = "(min-width: 768px)";
const BOTTOM_THRESHOLD_PX = 80;

type Props = {
  roomId: string;
  playerId: string;
  nickname: string;
  isEnabled: boolean;
  disabledReason?: string;
};

function formatTime(createdAt: unknown): string {
  if (!createdAt || typeof createdAt !== "object") return "";
  const ts = createdAt as { toDate?: () => Date; seconds?: number };
  const date =
    typeof ts.toDate === "function"
      ? ts.toDate()
      : typeof ts.seconds === "number"
        ? new Date(ts.seconds * 1000)
        : null;
  if (!date) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function ChatPanel({ roomId, playerId, nickname, isEnabled, disabledReason }: Props) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isTabletUp, setIsTabletUp] = useState(false);
  const [showNewMessageHint, setShowNewMessageHint] = useState(false);
  const [pendingNewMessageCount, setPendingNewMessageCount] = useState(0);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const hasInitializedRef = useRef(false);
  const isNearBottomRef = useRef(true);

  const { messages, sendMessage } = useChat(roomId);

  useEffect(() => {
    const mediaQuery = window.matchMedia(TABLET_MEDIA_QUERY);

    const syncMatch = (event?: MediaQueryListEvent) => {
      const matches = event?.matches ?? mediaQuery.matches;
      setIsTabletUp(matches);

      if (!matches) {
        setOpen(false);
        setShowNewMessageHint(false);
        setPendingNewMessageCount(0);
      }
    };

    syncMatch();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncMatch);
      return () => mediaQuery.removeEventListener("change", syncMatch);
    }

    mediaQuery.addListener(syncMatch);
    return () => mediaQuery.removeListener(syncMatch);
  }, []);

  const syncIsNearBottom = () => {
    const container = messagesContainerRef.current;

    if (!container) {
      isNearBottomRef.current = true;
      return;
    }

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    isNearBottomRef.current = distanceFromBottom <= BOTTOM_THRESHOLD_PX;
  };

  useEffect(() => {
    if (!hasInitializedRef.current) {
      knownMessageIdsRef.current = new Set(messages.map((message) => message.id));
      hasInitializedRef.current = true;
      return;
    }

    const knownMessageIds = knownMessageIdsRef.current;
    const newMessages = messages.filter((message) => !knownMessageIds.has(message.id));

    if (newMessages.length === 0) {
      return;
    }

    knownMessageIdsRef.current = new Set(messages.map((message) => message.id));

    const foreignMessages = newMessages.filter((message) => message.playerId !== playerId);
    const hasOnlyMyMessages = foreignMessages.length === 0;

    if (!open) {
      if (!hasOnlyMyMessages) {
        setUnreadCount((prev) => prev + foreignMessages.length);
      }
      return;
    }

    const shouldAutoScroll = hasOnlyMyMessages || (isNearBottomRef.current && !isInputFocused);

    if (shouldAutoScroll) {
      window.requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: hasOnlyMyMessages ? "smooth" : "auto" });
        setShowNewMessageHint(false);
        setPendingNewMessageCount(0);
        setUnreadCount(0);
      });
      return;
    }

    setShowNewMessageHint(true);
    setPendingNewMessageCount((prev) => prev + foreignMessages.length);
  }, [isInputFocused, messages, open, playerId]);

  useEffect(() => {
    if (!open) {
      setShowNewMessageHint(false);
      setPendingNewMessageCount(0);
      return;
    }

    setUnreadCount(0);
    window.requestAnimationFrame(() => {
      syncIsNearBottom();
    });
  }, [open]);

  useEffect(() => {
    if (!open || !isTabletUp) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isTabletUp, open]);

  const handleOpen = () => {
    setOpen(true);
    setUnreadCount(0);
    setShowNewMessageHint(false);
    setPendingNewMessageCount(0);
    window.setTimeout(() => inputRef.current?.focus(), 60);
  };

  const handleClose = () => setOpen(false);

  const handleScrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowNewMessageHint(false);
    setPendingNewMessageCount(0);
    isNearBottomRef.current = true;
  };

  const handleSend = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || !isEnabled || sending) return;
    setSending(true);
    try {
      await sendMessage(trimmed, playerId, nickname);
      setInputValue("");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      void handleSend();
    }
  };

  const handleEmojiClick = (emoji: string) => {
    if (!isEnabled) return;
    setInputValue((prev) => {
      const next = prev + emoji;
      return next.length <= CHAT_MAX_LENGTH ? next : prev;
    });
    inputRef.current?.focus();
  };

  if (!isTabletUp) {
    return null;
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="채팅 열기"
        onClick={open ? handleClose : handleOpen}
        className="relative hidden h-9 w-9 min-w-0 items-center justify-center rounded-xl border bg-dm-card text-dm-text-primary transition duration-200 hover:bg-dm-primary/10 active:scale-[0.98] md:inline-flex"
        style={{ borderColor: "rgb(var(--dm-card-border))" }}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {unreadCount > 0 && !open ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-dm-secondary px-0.5 text-[9px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          ref={panelRef}
          className="fixed inset-y-0 right-0 z-50 hidden w-80 translate-x-0 flex-col border-l shadow-dm-soft md:flex"
          style={{
            borderColor: "rgb(var(--dm-card-border))",
            backgroundColor: "rgb(var(--dm-card))",
          }}
        >
          <div
            className="flex shrink-0 items-center justify-between px-4 py-3"
            style={{ borderBottom: "1px solid rgb(var(--dm-card-border))" }}
          >
            <span className="text-sm font-semibold text-dm-text-primary">채팅</span>
            <button
              type="button"
              onClick={handleClose}
              aria-label="채팅 닫기"
              className="flex h-7 w-7 items-center justify-center rounded-md text-dm-text-secondary transition hover:text-dm-text-primary"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="relative min-h-0 flex-1">
            <div
              ref={messagesContainerRef}
              onScroll={syncIsNearBottom}
              className="h-full overflow-y-auto p-3"
            >
              {messages.length === 0 ? (
                <p className="mt-10 text-center text-xs text-dm-text-secondary">
                  아직 채팅이 없습니다.
                </p>
              ) : (
                <ul className="space-y-2">
                  {messages.map((msg) => {
                    const isMine = msg.playerId === playerId;
                    return (
                      <li
                        key={msg.id}
                        className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
                      >
                        {!isMine ? (
                          <span className="mb-0.5 text-[10px] font-medium text-dm-text-secondary">
                            {msg.nickname}
                          </span>
                        ) : null}
                        <div
                          className={`max-w-[85%] break-words rounded-2xl px-3 py-2 text-sm leading-snug ${
                            isMine ? "rounded-br-sm" : "rounded-bl-sm"
                          }`}
                          style={{
                            backgroundColor: isMine
                              ? "rgb(var(--dm-primary) / 0.22)"
                              : "rgb(var(--dm-card-muted))",
                            color: "rgb(var(--dm-text-primary))",
                          }}
                        >
                          {msg.message}
                        </div>
                        <span className="mt-0.5 text-[9px] text-dm-text-secondary/55">
                          {formatTime(msg.createdAt)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div ref={messagesEndRef} />
            </div>

            {showNewMessageHint ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3">
                <button
                  type="button"
                  onClick={handleScrollToBottom}
                  className="pointer-events-auto rounded-full border border-dm-primary/35 bg-dm-card/95 px-3 py-1.5 text-[11px] font-semibold text-dm-primary shadow-dm-soft transition hover:bg-dm-primary/10"
                >
                  새 메시지 {pendingNewMessageCount > 0 ? `${pendingNewMessageCount}개` : ""} 있습니다
                </button>
              </div>
            ) : null}
          </div>

          <div
            className="flex shrink-0 flex-wrap gap-0.5 px-2 py-1.5"
            style={{ borderTop: "1px solid rgb(var(--dm-card-border))" }}
          >
            {CHAT_EMOJI_LIST.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleEmojiClick(emoji)}
                disabled={!isEnabled}
                aria-label={`이모지 ${emoji} 입력`}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-lg transition hover:bg-dm-primary/10 active:scale-90 disabled:cursor-not-allowed disabled:opacity-35"
              >
                {emoji}
              </button>
            ))}
          </div>

          <div
            className="shrink-0 px-3 pb-4 pt-2"
            style={{ borderTop: "1px solid rgb(var(--dm-card-border))" }}
          >
            {!isEnabled && disabledReason ? (
              <p className="mb-2 text-center text-[11px] text-dm-text-secondary">
                {disabledReason}
              </p>
            ) : null}
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => {
                  if (e.target.value.length <= CHAT_MAX_LENGTH) {
                    setInputValue(e.target.value);
                  }
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                placeholder={isEnabled ? "메시지 입력..." : "채팅 불가"}
                disabled={!isEnabled}
                maxLength={CHAT_MAX_LENGTH}
                className="dm-input flex-1 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={!isEnabled || !inputValue.trim() || sending}
                className="inline-flex shrink-0 items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white transition duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: "rgb(var(--dm-primary))" }}
              >
                전송
              </button>
            </div>
            {isEnabled ? (
              <p className="mt-1 text-right text-[10px] text-dm-text-secondary/55">
                {inputValue.length} / {CHAT_MAX_LENGTH}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
