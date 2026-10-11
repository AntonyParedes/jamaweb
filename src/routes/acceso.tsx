import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/jama/AppShell";
import { AuthForm } from "@/components/jama/AuthForm";
import { safeNext, useAuth } from "@/lib/auth";
import type { AuthMode } from "@/lib/auth-actions";
import { getSupabase } from "@/lib/supabase";

export const Route = createFileRoute("/acceso")({
  validateSearch: (search: Record<string, unknown>) => ({
    next: safeNext(search["next"]),
    mode: (["register", "recover", "reset"].includes(String(search["mode"]))
      ? search["mode"]
      : "login") as AuthMode,
  }),
  head: () => ({ meta: [{ title: "Acceder — JAMA" }, { name: "robots", content: "noindex" }] }),
  component: Acceso,
});

export function Acceso() {
  const { mode, next } = Route.useSearch();
  const { loading, session, recovery } = useAuth();
  const navigate = useNavigate();
  const effectiveMode = recovery ? "reset" : mode;
  useEffect(() => {
    if (loading || !session || recovery || (mode !== "login" && mode !== "register")) return;
    let active = true;
    // A stale local session must not bounce repeatedly between login/checkout.
    void getSupabase()
      ?.auth.getUser()
      .then(({ data, error }) => {
        if (active && !error && data.user?.id === session.user.id)
          void navigate({ to: "/", replace: true });
      })
      .catch(() => {
        /* Keep the access form available when the session cannot be verified. */
      });
    return () => {
      active = false;
    };
  }, [loading, session, recovery, mode, navigate]);
  return (
    <AppShell>
      <section className="mx-auto max-w-md px-4 py-6">
        {loading ? (
          <p role="status">Comprobando tu sesión…</p>
        ) : (
          <AuthForm key={effectiveMode} mode={effectiveMode} next={next} />
        )}
      </section>
    </AppShell>
  );
}
