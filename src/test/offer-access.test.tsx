import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Oferta } from "@/routes/oferta.$id";

const state = vi.hoisted(() => ({
  id: "00000000-0000-4000-8000-000000000021",
  session: null as unknown,
  loading: false,
  recovery: false,
  navigate: vi.fn(),
  contact: vi.fn(),
  signOut: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({ ...options, useParams: () => ({ id: state.id }) }),
  useNavigate: () => state.navigate,
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock("@/components/jama/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => state }));
vi.mock("@/lib/catalog", () => ({
  useCatalog: () => ({
    loading: false,
    error: "",
    refresh: state.refresh,
    products: [
      {
        id: state.id,
        name: "Torta",
        store: "Negocio",
        zone: "Centro",
        price: 15,
        originalPrice: 25,
        description: "Chocolate",
        stock: 4,
        image: "/foto.png",
        startsAt: "2026-10-10T10:00:00Z",
        endsAt: "2030-10-10T20:00:00Z",
      },
    ],
  }),
}));
vi.mock("@/lib/offers-api", () => ({ contactOffer: state.contact }));
vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({ auth: { signOut: state.signOut } }) }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  state.session = null;
  state.loading = false;
});
describe("Offer contact access", () => {
  it("keeps browsing public and returns a guest to the exact offer after login", () => {
    render(<Oferta />);
    expect(screen.getByRole("heading", { name: "Torta" })).toBeVisible();
    expect(state.navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Quiero este descuento" }));
    expect(state.navigate).toHaveBeenCalledWith({
      to: "/acceso",
      search: { next: `/oferta/${state.id}`, mode: "login" },
    });
    expect(state.contact).not.toHaveBeenCalled();
  });
  it("waits for session restoration before a contact request", () => {
    state.loading = true;
    render(<Oferta />);
    expect(screen.getByRole("button", { name: "Comprobando sesión…" })).toBeDisabled();
    expect(state.contact).not.toHaveBeenCalled();
  });
  it("rejects a stale visible offer when the database reports it unavailable", async () => {
    state.session = { access_token: "synthetic-token" };
    state.contact.mockResolvedValue({
      ok: false,
      reason: "unavailable",
      message: "Este descuento ya no está disponible.",
    });
    render(<Oferta />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Quiero este descuento" }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent("ya no está disponible");
    expect(state.contact).toHaveBeenCalledWith({
      data: { accessToken: "synthetic-token", offerId: state.id },
    });
    expect(state.signOut).not.toHaveBeenCalled();
  });
  it("does not open a discount that expired while the request was in flight", async () => {
    state.session = { access_token: "synthetic-token" };
    let elapsed = 0;
    vi.spyOn(performance, "now").mockImplementation(() => elapsed);
    state.contact.mockImplementation(async () => {
      elapsed = 100;
      return {
        ok: true,
        value: {
          url: "https://wa.me/51912345678",
          serverNow: "2026-10-10T20:00:00.000Z",
          endsAt: "2026-10-10T20:00:00.050Z",
        },
      };
    });
    render(<Oferta />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Quiero este descuento" }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent("acaba de vencer");
    expect(state.refresh).toHaveBeenCalledOnce();
  });
  it("clears an invalid session while preserving the offer's login return", async () => {
    state.session = { access_token: "expired-token" };
    state.contact.mockResolvedValue({
      ok: false,
      reason: "session",
      message: "Inicia sesión para continuar.",
    });
    state.signOut.mockResolvedValue({ error: null });
    render(<Oferta />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Quiero este descuento" }));
    });
    expect(state.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(state.navigate).toHaveBeenCalledWith({
      to: "/acceso",
      search: { next: `/oferta/${state.id}`, mode: "login" },
    });
  });
});
