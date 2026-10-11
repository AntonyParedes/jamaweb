import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthForm } from "./AuthForm";

const submitAuth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth-actions", async (original) => ({
  ...(await original<typeof import("@/lib/auth-actions")>()),
  submitAuth,
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ session: null }) }));
vi.mock("@/lib/supabase", () => ({
  getSupabaseConfig: () => ({ url: "https://example.supabase.co", key: "public" }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("Auth form submission", () => {
  it("prevents duplicate requests while authentication is pending", async () => {
    let resolve!: (value: string) => void;
    submitAuth.mockReturnValue(
      new Promise<string>((done) => {
        resolve = done;
      }),
    );
    render(<AuthForm mode="login" next="/checkout" />);
    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "ana@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "password" } });
    const form = screen.getByRole("button", { name: "Iniciar sesión" }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(submitAuth).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Un momento…" })).toBeDisabled();
    await act(async () => {
      resolve("Sesión iniciada.");
    });
    expect(screen.getByRole("status")).toHaveTextContent("Sesión iniciada");
  });
  it("does not expose transport errors to the user", async () => {
    submitAuth.mockRejectedValue(new Error("private backend stack or credential"));
    render(<AuthForm mode="login" next="/checkout" />);
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "Iniciar sesión" }).closest("form")!);
    });
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos completar la solicitud");
    expect(screen.queryByText(/private backend/)).toBeNull();
  });
});
