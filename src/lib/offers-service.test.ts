import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { verifiedAdmin, verifiedContact } from "./offers-service";

const id = "00000000-0000-4000-8000-000000000021";
const getUser = vi.fn();
const rpc = vi.fn();
const client = { auth: { getUser }, rpc } as unknown as SupabaseClient;
beforeEach(() => {
  vi.resetAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
});
describe("Administrator verification", () => {
  it("requires a verified session and a database role, not user metadata", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "user", user_metadata: { admin: true } } },
      error: null,
    });
    rpc.mockResolvedValue({ data: false, error: null });
    await expect(verifiedAdmin(client)).rejects.toThrow("No tienes permisos");
    expect(rpc).toHaveBeenCalledWith("jama_is_admin");
    rpc.mockResolvedValue({ data: true, error: null });
    await expect(verifiedAdmin(client)).resolves.toMatchObject({ id: "user" });
  });
  it("blocks expired sessions before checking administrator privileges", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { code: "bad_jwt" } });
    await expect(verifiedAdmin(client)).rejects.toThrow("Inicia sesión");
    expect(rpc).not.toHaveBeenCalled();
  });
});
describe("Verified WhatsApp contact", () => {
  it("uses the server price and seller number after verifying authentication", async () => {
    rpc.mockResolvedValue({
      data: {
        id,
        name: "Torta & café",
        priceCents: 1799,
        whatsapp: "51912345678",
        endsAt: "2026-10-11T12:00:00Z",
        serverNow: "2026-10-11T11:00:00Z",
      },
      error: null,
    });
    const result = await verifiedContact(client, id);
    expect(getUser).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("jama_contact_offer", { offer_id: id });
    if (!result.ok) throw new Error(result.message);
    expect(new URL(result.value.url).searchParams.get("text")).toContain("S/ 17.99");
    expect(result.value.url).toContain("https://wa.me/51912345678");
  });
  it("rejects expired or invalid sessions before contacting the database", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { code: "bad_jwt" } });
    expect(await verifiedContact(client, id)).toMatchObject({ ok: false, reason: "session" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("keeps a session during a service outage without exposing the transport error", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthRetryableFetchError", status: 503, message: "private backend details" },
    });
    expect(await verifiedContact(client, id)).toMatchObject({ ok: false, reason: "unavailable" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects paused, expired or depleted offers and does not create orders", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Offer unavailable" } });
    expect(await verifiedContact(client, id)).toMatchObject({ ok: false, reason: "unavailable" });
    expect(rpc).toHaveBeenCalledOnce();
    rpc.mockResolvedValue({
      data: {
        id,
        name: "Torta",
        priceCents: 1500,
        whatsapp: "51912345678",
        endsAt: "2026-10-11T10:00:00Z",
        serverNow: "2026-10-11T11:00:00Z",
      },
      error: null,
    });
    expect(await verifiedContact(client, id)).toMatchObject({ ok: false });
  });
});
