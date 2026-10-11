import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Checkout } from "@/routes/checkout";

const state = vi.hoisted(() => ({
  session: null as unknown,
  loading: false,
  recovery: false,
  navigate: vi.fn(),
  quote: vi.fn(),
  signOut: vi.fn(),
  cart: [{ productId: "torta-chocolate", qty: 2 }],
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  useNavigate: () => state.navigate,
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock("@/components/jama/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => state }));
vi.mock("@/lib/cart", () => ({ useCart: () => state.cart }));
vi.mock("@/lib/checkout", () => ({ requestCheckoutQuote: state.quote }));
vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({ auth: { signOut: state.signOut } }) }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  state.session = null;
  state.loading = false;
  state.recovery = false;
});
describe("Checkout access gate", () => {
  it("redirects a guest to login without showing checkout or querying prices", () => {
    render(<Checkout />);
    expect(state.navigate).toHaveBeenCalledWith({
      to: "/acceso",
      search: { next: "/checkout", mode: "login" },
      replace: true,
    });
    expect(state.quote).not.toHaveBeenCalled();
    expect(screen.queryByText("El pago estará disponible pronto")).toBeNull();
    expect(state.cart).toHaveLength(1);
  });
  it("waits for session restoration before deciding access", () => {
    state.loading = true;
    render(<Checkout />);
    expect(state.navigate).not.toHaveBeenCalled();
    expect(state.quote).not.toHaveBeenCalled();
  });
  it("uses an authenticated quote and never enables payment without a provider", async () => {
    state.session = { access_token: "valid-token" };
    state.quote.mockResolvedValue({
      ok: true,
      quote: {
        items: [
          {
            productId: "torta-chocolate",
            name: "Chocolate",
            qty: 2,
            unitPriceCents: 1700,
            subtotalCents: 3400,
          },
        ],
        totalCents: 3400,
        currency: "PEN",
        expiresAt: new Date(Date.now() + 300000).toISOString(),
      },
    });
    await act(async () => {
      render(<Checkout />);
    });
    expect(state.quote).toHaveBeenCalledWith({
      data: { accessToken: "valid-token", items: state.cart },
    });
    expect(screen.getByText("Total: S/ 34.00")).toBeVisible();
    expect(screen.getByRole("button", { name: "Pago todavía no disponible" })).toBeDisabled();
  });
  it("removes an invalid local session and sends the user back to login", async () => {
    state.session = { access_token: "revoked-token" };
    state.quote.mockResolvedValue({ ok: false, reason: "session", message: "Sesión vencida" });
    state.signOut.mockResolvedValue({ error: null });
    await act(async () => {
      render(<Checkout />);
    });
    expect(state.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(state.navigate).toHaveBeenCalledWith({
      to: "/acceso",
      search: { next: "/checkout", mode: "login" },
      replace: true,
    });
    expect(screen.queryByText("Carrito verificado")).toBeNull();
  });
});
