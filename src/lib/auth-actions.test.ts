import { beforeEach, describe, expect, it, vi } from "vitest";
import { signupSchema, submitAuth } from "./auth-actions";
import { safeNext } from "./auth";

const auth = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("./supabase", () => ({ getSupabase: () => ({ auth }) }));
const values = {
  name: "Ana Paredes",
  email: "ana@example.com",
  password: "strong-password",
  confirmation: "strong-password",
  accepted: true,
};
beforeEach(() => {
  vi.resetAllMocks();
});

describe("Authentication actions", () => {
  it("validates full name, email, passwords and consent before signup", () => {
    for (const patch of [
      { name: "A" },
      { email: "invalid" },
      { password: "short" },
      { confirmation: "different" },
      { accepted: false },
    ])
      expect(signupSchema.safeParse({ ...values, ...patch }).success).toBe(false);
  });
  it("does not submit registration without consent", async () => {
    await expect(
      submitAuth("register", { ...values, accepted: false }, "/checkout"),
    ).rejects.toThrow("Acepta");
    expect(auth.signUp).not.toHaveBeenCalled();
  });
  it("registers through Auth and explains pending email confirmation", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    const message = await submitAuth("register", values, "/checkout");
    expect(message).toContain("confirmar tu cuenta");
    const payload = auth.signUp.mock.calls[0]?.[0];
    expect(payload.email).toBe(values.email);
    expect(payload.options.data.full_name).toBe(values.name);
    expect(payload.options.data).not.toHaveProperty("password");
    expect(new URL(payload.options.emailRedirectTo).searchParams.get("next")).toBe("/checkout");
  });
  it("signs in with the supplied credentials and masks account enumeration errors", async () => {
    auth.signInWithPassword.mockResolvedValueOnce({ error: null });
    await submitAuth("login", values, "/checkout");
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: values.email,
      password: values.password,
    });
    auth.signInWithPassword.mockResolvedValueOnce({
      error: { code: "user_not_found", message: "internal email not found" },
    });
    await expect(submitAuth("login", values, "/checkout")).rejects.toThrow("Revisa tus datos");
  });
  it("sends recovery to the same origin and does not disclose account existence", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    expect(await submitAuth("recover", values, "/checkout")).toContain("Si existe una cuenta");
    const redirect = new URL(auth.resetPasswordForEmail.mock.calls[0]?.[1].redirectTo);
    expect(redirect.origin).toBe(window.location.origin);
    expect(redirect.searchParams.get("mode")).toBe("reset");
  });
  it("explains the email quota for recovery and registration", async () => {
    const error = { code: "over_email_send_rate_limit", message: "429: email rate limit exceeded" };
    auth.resetPasswordForEmail.mockResolvedValue({ error });
    auth.signUp.mockResolvedValue({ data: { session: null }, error });
    for (const mode of ["recover", "register"] as const)
      await expect(submitAuth(mode, values, "/cuenta")).rejects.toThrow(
        "Se alcanzó el límite de envío de correos",
      );
  });
  it("does not expose mail provider details or account existence on recovery errors", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({
      error: { code: "unexpected_failure", message: "private SMTP details for an email account" },
    });
    await expect(submitAuth("recover", values, "/cuenta")).rejects.toThrow(
      "No pudimos enviar el correo",
    );
  });
  it("requires a verified recovery session before changing the password", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: {} });
    await expect(submitAuth("reset", values, "/cuenta")).rejects.toThrow("enlace de recuperación");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("updates the password via Auth then signs out", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: "user-a" } }, error: null });
    auth.updateUser.mockResolvedValue({ error: null });
    auth.signOut.mockResolvedValue({ error: null });
    expect(await submitAuth("reset", values, "/cuenta")).toContain("actualizada");
    expect(auth.updateUser).toHaveBeenCalledWith({ password: values.password });
    expect(auth.signOut).toHaveBeenCalledOnce();
  });
  it("rejects external and malformed return URLs", () => {
    for (const path of [
      "https://evil.example",
      "//evil.example",
      "/checkout?next=bad",
      "javascript:alert(1)",
    ])
      expect(safeNext(path)).toBe("/cuenta");
    expect(safeNext("/checkout")).toBe("/checkout");
  });
});
