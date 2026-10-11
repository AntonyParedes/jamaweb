import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { LogOut, ShoppingBag, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/jama/AppShell";
import { useAuth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { AdminLink } from "@/components/jama/AdminLink";

export const Route = createFileRoute("/cuenta")({
  head: () => ({ meta: [{ title: "Mi cuenta — JAMA" }, { name: "robots", content: "noindex" }] }),
  component: Cuenta,
});

function Cuenta() {
  const { session, loading } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const busy = useRef(false);
  const userId = session?.user.id;
  useEffect(() => {
    let active = true;
    setName("");
    setPhone("");
    setError("");
    setLoadingProfile(true);
    const client = getSupabase();
    if (!userId || !client) {
      setLoadingProfile(false);
      return;
    }
    void client
      .from("profiles")
      .select("id, full_name, phone")
      .eq("id", userId)
      .single()
      .then(
        ({ data, error: profileError }) => {
          if (!active) return;
          if (profileError) setError("No pudimos cargar tus datos. Inténtalo nuevamente.");
          else {
            setName(data.full_name ?? "");
            setPhone(data.phone ?? "");
          }
          setLoadingProfile(false);
        },
        () => {
          if (active) {
            setError("No pudimos cargar tus datos. Inténtalo nuevamente.");
            setLoadingProfile(false);
          }
        },
      );
    return () => {
      active = false;
    };
  }, [userId, retry]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current || !userId) return;
    const cleanPhone = phone.replace(/\s/g, "");
    if (
      name.trim().length < 3 ||
      name.trim().length > 120 ||
      (cleanPhone && !/^9\d{8}$/.test(cleanPhone))
    ) {
      setError(
        "Escribe tu nombre completo y un celular válido de 9 dígitos, o deja el teléfono vacío.",
      );
      return;
    }
    const client = getSupabase();
    if (!client) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const { error: updateError, data } = await client
        .from("profiles")
        .update({ full_name: name.trim(), phone: cleanPhone || null })
        .eq("id", userId)
        .select("id")
        .single();
      if (updateError || !data) setError("No pudimos guardar tus datos. Inténtalo nuevamente.");
      else toast.success("Datos guardados");
    } catch {
      setError("No pudimos guardar tus datos. Inténtalo nuevamente.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  async function signOut() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      const client = getSupabase();
      if (!client) return;
      const { error: signOutError } = await client.auth.signOut();
      if (signOutError) toast.error("No pudimos cerrar tu sesión. Inténtalo nuevamente.");
      else toast.success("Sesión cerrada");
    } catch {
      toast.error("No pudimos cerrar tu sesión. Inténtalo nuevamente.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <AppShell>
      <section className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <h1 className="text-2xl font-black sm:text-3xl">Mi cuenta</h1>
        <Link
          to="/vender"
          className="press flex min-h-12 items-center justify-center rounded-full bg-navy px-5 font-black text-navy-foreground"
        >
          Publicar una oferta · Mis ofertas
        </Link>
        <AdminLink />
        {loading ? (
          <p role="status">Comprobando tu sesión…</p>
        ) : !session ? (
          <div className="space-y-4 rounded-3xl bg-card p-6 shadow-soft">
            <UserRound className="size-9" />
            <h2 className="text-xl font-black">Compra con tu cuenta de JAMA</h2>
            <p className="text-sm text-muted-foreground">
              Puedes explorar y preparar tu carrito sin cuenta. Ingresa cuando quieras continuar al
              pago.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/acceso"
                search={{ next: "/cuenta", mode: "login" }}
                className="press inline-flex min-h-12 items-center rounded-full bg-lime px-6 font-black"
              >
                Iniciar sesión
              </Link>
              <Link
                to="/acceso"
                search={{ next: "/cuenta", mode: "register" }}
                className="press inline-flex min-h-12 items-center rounded-full border px-6 font-black"
              >
                Crear cuenta
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="break-all text-sm text-muted-foreground">{session.user.email}</p>
              <button
                disabled={pending}
                onClick={signOut}
                className="press inline-flex min-h-11 items-center gap-2 rounded-full border px-4 font-bold disabled:opacity-50"
              >
                <LogOut className="size-4" />
                Cerrar sesión
              </button>
            </div>
            {loadingProfile ? (
              <p role="status">Cargando tus datos…</p>
            ) : (
              <form onSubmit={save} className="space-y-4 rounded-3xl bg-card p-5 shadow-soft">
                <h2 className="flex items-center gap-2 text-lg font-black">
                  <UserRound className="size-5" />
                  Mis datos
                </h2>
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                <label className="block space-y-1 text-sm font-bold">
                  Nombre completo
                  <input
                    required
                    autoComplete="name"
                    minLength={3}
                    maxLength={120}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="min-h-12 w-full rounded-xl border bg-card px-4 text-base outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                <label className="block space-y-1 text-sm font-bold">
                  WhatsApp (opcional)
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={15}
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="min-h-12 w-full rounded-xl border bg-card px-4 text-base outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                <button
                  disabled={pending || !name.trim()}
                  type="submit"
                  className="press min-h-12 w-full rounded-full bg-lime font-black disabled:opacity-50"
                >
                  {pending ? "Guardando…" : "Guardar"}
                </button>
                {error && (
                  <button
                    type="button"
                    onClick={() => setRetry((value) => value + 1)}
                    className="min-h-11 font-bold underline"
                  >
                    Volver a cargar mis datos
                  </button>
                )}
                <p className="text-center text-xs text-muted-foreground">
                  Tus datos se guardan en tu cuenta y solo tú puedes acceder a ellos.
                </p>
              </form>
            )}
            <div className="rounded-3xl bg-card p-5 shadow-soft">
              <h2 className="flex items-center gap-2 text-lg font-black">
                <ShoppingBag className="size-5" />
                Mis pedidos
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                El historial estará disponible cuando se habiliten las compras. Iniciar sesión no
                crea pedidos.
              </p>
            </div>
          </>
        )}
      </section>
    </AppShell>
  );
}
