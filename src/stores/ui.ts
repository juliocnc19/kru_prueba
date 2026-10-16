"use client";

import { create } from "zustand";

type UiState = { menuOpen: boolean; setMenuOpen: (open: boolean) => void };
export const useUiStore = create<UiState>((set) => ({ menuOpen: false, setMenuOpen: (menuOpen) => set({ menuOpen }) }));
