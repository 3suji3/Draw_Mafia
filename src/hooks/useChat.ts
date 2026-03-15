"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/firebase/firebase";
import type { ChatMessage } from "@/types/chat";
import { CHAT_MAX_LENGTH } from "@/types/chat";

const MESSAGES_LIMIT = 100;

export function useChat(roomId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!roomId) return;

    const messagesQuery = query(
      collection(db, "rooms", roomId, "messages"),
      orderBy("createdAt", "asc"),
      limit(MESSAGES_LIMIT)
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const msgs = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<ChatMessage, "id">),
      }));
      setMessages(msgs);
    });

    return unsubscribe;
  }, [roomId]);

  const sendMessage = async (
    text: string,
    playerId: string,
    nickname: string
  ): Promise<void> => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > CHAT_MAX_LENGTH || !roomId) return;

    await addDoc(collection(db, "rooms", roomId, "messages"), {
      playerId,
      nickname,
      message: trimmed,
      createdAt: serverTimestamp(),
    });
  };

  return { messages, sendMessage };
}
