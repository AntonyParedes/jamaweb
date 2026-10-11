import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./auth";

const state = vi.hoisted(() => ({
  callback: null as null | ((event: string, session: unknown) => void),
  getSession: vi.fn(),
  unsubscribe: vi.fn(),
}));
vi.mock("./supabase", () => ({
  getSupabase: () => ({
    auth: {
      getSession: state.getSession,
      onAuthStateChange: (callback: typeof state.callback) => {
        state.callback = callback;
        return { data: { subscription: { unsubscribe: state.unsubscribe } } };
      },
    },
  }),
}));
function Status() {
  const { session, loading, recovery } = useAuth();
  return (
    <p role="status">
      {loading ? "loading" : session ? session.user.id : "guest"}
      {recovery ? ":recovery" : ""}
    </p>
  );
}
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("Auth session lifecycle", () => {
  it("restores a session and reflects signout without clearing the cart", async () => {
    localStorage.setItem("jama-cart-v1", '[{"productId":"torta-chocolate","qty":2}]');
    state.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-a" } } },
      error: null,
    });
    await act(async () => {
      render(
        <AuthProvider>
          <Status />
        </AuthProvider>,
      );
    });
    expect(screen.getByRole("status")).toHaveTextContent("user-a");
    act(() => state.callback?.("SIGNED_OUT", null));
    expect(screen.getByRole("status")).toHaveTextContent("guest");
    expect(JSON.parse(localStorage.getItem("jama-cart-v1")!)).toHaveLength(1);
  });
  it("does not overwrite a recent auth event with a stale initial session", async () => {
    let resolve!: (value: unknown) => void;
    state.getSession.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render(
      <AuthProvider>
        <Status />
      </AuthProvider>,
    );
    act(() => state.callback?.("SIGNED_IN", { user: { id: "user-a" } }));
    await act(async () => {
      resolve({ data: { session: null }, error: null });
    });
    expect(screen.getByRole("status")).toHaveTextContent("user-a");
    act(() => state.callback?.("PASSWORD_RECOVERY", { user: { id: "user-a" } }));
    expect(screen.getByRole("status")).toHaveTextContent("recovery");
    act(() => state.callback?.("SIGNED_OUT", null));
    expect(screen.getByRole("status")).not.toHaveTextContent("recovery");
  });
});
