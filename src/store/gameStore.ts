import { create } from "zustand";
import { GameStatus } from "@/types/game";

type GameStoreState = {
  status: GameStatus;
  setStatus: (next: GameStatus) => void;
};

export const useGameStore = create<GameStoreState>((set) => ({
  status: "waiting",
  setStatus: (next) => set({ status: next }),
}));
