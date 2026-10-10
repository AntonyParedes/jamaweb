import { useSyncExternalStore } from "react";

export type Reservation = {
  id: string;
  productId: string;
  name: string;
  phone: string;
  qty: number;
  createdAt: string;
};

type State = {
  favorites: string[];
  reservations: Reservation[];
  profile: { name: string; phone: string };
};

const KEY = "jama-state-v1";
const empty: State = { favorites: [], reservations: [], profile: { name: "", phone: "" } };
let state: State = empty;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = { ...empty, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
}

function set(next: State) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  load();
  listeners.add(l);
  l();
  return () => listeners.delete(l);
}

export function useJama() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => empty,
  );
}

export function toggleFavorite(id: string) {
  load();
  const has = state.favorites.includes(id);
  set({ ...state, favorites: has ? state.favorites.filter((f) => f !== id) : [...state.favorites, id] });
  return !has;
}

export function addReservation(r: Omit<Reservation, "id" | "createdAt">) {
  load();
  const res: Reservation = { ...r, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  set({ ...state, reservations: [res, ...state.reservations], profile: { name: r.name, phone: r.phone } });
  return res;
}

export function cancelReservation(id: string) {
  load();
  set({ ...state, reservations: state.reservations.filter((r) => r.id !== id) });
}

export function saveProfile(profile: State["profile"]) {
  load();
  set({ ...state, profile });
}
