import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/jama/AppShell";
import { sellerField } from "@/components/jama/OfferForm";
import { useAuth } from "@/lib/auth";
import { useCategories } from "@/lib/categories";
import { fetchBusinessReviews, reviewBusiness } from "@/lib/business-review-api";

export const Route = createFileRoute("/administracion")({
  head: () => ({
    meta: [{ title: "Revisar negocios — JAMA" }, { name: "robots", content: "noindex" }],
  }),
  component: Administracion,
});

export function Administracion() {
  const { session, loading, recovery } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { categories } = useCategories();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("pending");
  const busy = useRef(false);
  const query = useQuery({
    queryKey: ["jama-business-reviews", session?.user.id],
    enabled: !!session && !loading && !recovery,
    queryFn: async () => {
      if (!session) throw new Error("Inicia sesión para continuar.");
      const result = await fetchBusinessReviews({ data: { accessToken: session.access_token } });
      if (!result.ok) throw new Error(result.message);
      return result.value;
    },
    retry: false,
  });
  useEffect(() => {
    setNotes({});
    setMessage("");
  }, [session?.user.id]);
  useEffect(() => {
    if (!loading && (!session || recovery))
      void navigate({
        to: "/acceso",
        search: { next: "/cuenta", mode: recovery ? "reset" : "login" },
        replace: true,
      });
  }, [loading, session, recovery, navigate]);
  async function review(
    id: string,
    decision: "approved" | "rejected" | "pending",
    previousNote: string,
  ) {
    if (!session || busy.current) return;
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      const result = await reviewBusiness({
        data: {
          accessToken: session.access_token,
          businessId: id,
          decision,
          note: notes[id] ?? previousNote,
        },
      });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["jama-business-reviews"] }),
        queryClient.invalidateQueries({ queryKey: ["jama-catalog"] }),
      ]);
      setMessage("Revisión guardada.");
    } catch {
      setMessage("No pudimos guardar la revisión. Inténtalo nuevamente.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <AppShell>
      <section className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <h1 className="text-2xl font-black sm:text-3xl">Revisar negocios</h1>
        {loading || !session || recovery || query.isPending ? (
          <p role="status">Comprobando permisos…</p>
        ) : query.error ? (
          <div role="alert" className="rounded-2xl bg-muted p-5">
            <p>{query.error.message}</p>
            <button onClick={() => void query.refetch()} className="min-h-11 font-bold underline">
              Reintentar
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Revisa la categoría, la ubicación y el WhatsApp comercial antes de aprobar. Solo
              admite negocios compatibles con ofertas de cierre. Retirar la aprobación oculta sus
              ofertas de inmediato.
            </p>
            <label className="block space-y-1 text-sm font-bold">
              Estado de las solicitudes
              <select
                aria-label="Estado de las solicitudes"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className={sellerField}
              >
                <option value="pending">En revisión</option>
                <option value="approved">Aprobados</option>
                <option value="rejected">No aprobados</option>
                <option value="all">Todos</option>
              </select>
            </label>
            <button
              disabled={pending}
              onClick={() => void query.refetch()}
              className="min-h-11 font-bold underline"
            >
              Actualizar solicitudes
            </button>
            {message && (
              <p role="status" className="rounded-xl bg-muted p-3 text-sm">
                {message}
              </p>
            )}
            {!(query.data ?? []).some((b) => filter === "all" || b.status === filter) && (
              <p className="rounded-2xl bg-muted p-5">No hay solicitudes en este estado.</p>
            )}
            <ul className="space-y-4">
              {(query.data ?? [])
                .filter((b) => filter === "all" || b.status === filter)
                .map((b) => (
                  <li
                    key={b.id}
                    className="min-w-0 space-y-3 rounded-3xl bg-card p-4 shadow-soft sm:p-5"
                  >
                    <h2 className="break-words text-xl font-black">{b.name}</h2>
                    <p className="text-sm">
                      {categories.find((c) => c.id === b.category)?.label ?? b.category}
                    </p>
                    <p className="break-words text-sm">{b.zone}</p>
                    <p className="text-sm">WhatsApp: +{b.whatsapp}</p>
                    <label className="block space-y-1 text-sm font-bold">
                      Observación para el negocio
                      <textarea
                        aria-label={`Observación para ${b.name}`}
                        maxLength={1000}
                        rows={3}
                        disabled={pending}
                        value={notes[b.id] ?? b.review_note}
                        onChange={(e) => setNotes({ ...notes, [b.id]: e.target.value })}
                        className={`${sellerField} py-3`}
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        disabled={pending || b.status === "approved"}
                        onClick={() => void review(b.id, "approved", b.review_note)}
                        className="press min-h-12 rounded-full bg-lime px-5 font-black disabled:opacity-50"
                      >
                        Aprobar
                      </button>
                      <button
                        disabled={pending || b.status === "rejected"}
                        onClick={() => void review(b.id, "rejected", b.review_note)}
                        className="min-h-12 rounded-full border px-5 font-bold disabled:opacity-50"
                      >
                        No aprobar
                      </button>
                      <button
                        disabled={pending || b.status === "pending"}
                        onClick={() => void review(b.id, "pending", b.review_note)}
                        className="min-h-12 rounded-full border px-5 font-bold disabled:opacity-50"
                      >
                        Volver a revisión
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          </>
        )}
      </section>
    </AppShell>
  );
}
