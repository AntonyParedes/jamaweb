import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Store } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/jama/AppShell";
import { OfferForm, sellerField } from "@/components/jama/OfferForm";
import { useAuth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import {
  businessSchema,
  offerStatus,
  formatOfferTime,
  type Business,
  type SellerOffer,
} from "@/lib/offers";
import { imageUrl, type OfferFailure } from "@/lib/offers-service";
import { changeOffer, fetchSeller, saveBusiness } from "@/lib/offers-api";
import { useCategories } from "@/lib/categories";

export const Route = createFileRoute("/vender")({
  head: () => ({
    meta: [{ title: "Publicar una oferta — JAMA" }, { name: "robots", content: "noindex" }],
  }),
  component: Vender,
});
export function Vender() {
  const { session, loading, recovery } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    categories,
    loading: categoriesLoading,
    error: categoriesError,
    refresh: refreshCategories,
  } = useCategories();
  const [business, setBusiness] = useState<Business | null>(null);
  const [offers, setOffers] = useState<SellerOffer[]>([]);
  const [form, setForm] = useState({ name: "", zone: "", whatsapp: "+51 ", category: "" });
  const [editingBusiness, setEditingBusiness] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<{ offer: SellerOffer | null } | null>(null);
  const [clock, setClock] = useState({ server: 0, received: 0 });
  const [elapsed, setElapsed] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const busy = useRef(false);
  const loadedUser = useRef<string | null>(null);
  useEffect(() => {
    if (!loading && (!session || recovery))
      void navigate({
        to: "/acceso",
        search: { next: "/vender", mode: recovery ? "reset" : "login" },
        replace: true,
      });
  }, [loading, session, recovery, navigate]);
  const failure = useCallback(
    async (result: OfferFailure) => {
      setError(result.message);
      if (result.reason === "session") {
        await getSupabase()?.auth.signOut({ scope: "local" });
        void navigate({ to: "/acceso", search: { next: "/vender", mode: "login" }, replace: true });
      }
    },
    [navigate],
  );
  useEffect(() => {
    if (!session || loading || recovery) return;
    let active = true;
    if (loadedUser.current !== session.user.id) {
      setBusiness(null);
      setOffers([]);
      setEditor(null);
      setDeleteId(null);
      setForm({ name: "", zone: "", whatsapp: "+51 ", category: "" });
      loadedUser.current = null;
    }
    setChecking(true);
    setError("");
    void fetchSeller({ data: { accessToken: session.access_token } })
      .then(async (result) => {
        if (!active) return;
        if (!result.ok) {
          await failure(result);
          return;
        }
        setBusiness(result.value.business);
        setOffers(result.value.offers);
        loadedUser.current = session.user.id;
        if (result.value.business)
          setForm({
            name: result.value.business.name,
            zone: result.value.business.zone,
            whatsapp: `+${result.value.business.whatsapp}`,
            category: result.value.business.category,
          });
        setClock({ server: Date.parse(result.value.serverNow), received: performance.now() });
      })
      .catch(() => {
        if (active) setError("No pudimos cargar tus ofertas. Inténtalo nuevamente.");
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [session, loading, recovery, revision, failure]);
  useEffect(() => {
    const timer = window.setInterval(
      () => setElapsed(Math.max(0, performance.now() - clock.received)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [clock]);
  async function submitBusiness(event: React.FormEvent) {
    event.preventDefault();
    if (!session || busy.current) return;
    const parsed = businessSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los datos del negocio.");
      return;
    }
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = await saveBusiness({
        data: { accessToken: session.access_token, business: parsed.data },
      });
      if (!result.ok) {
        await failure(result);
        return;
      }
      setBusiness(result.value);
      setEditingBusiness(false);
      setRevision((v) => v + 1);
      await queryClient.invalidateQueries({ queryKey: ["jama-catalog"] });
      toast.success(
        result.value.status === "approved"
          ? "Negocio guardado"
          : "Solicitud guardada. Revisaremos tu negocio antes de publicar.",
      );
    } catch {
      setError("No pudimos guardar tu negocio. Inténtalo nuevamente.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function action(offerId: string, action: "pause" | "activate" | "delete") {
    if (!session || busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = await changeOffer({
        data: { accessToken: session.access_token, offerId, action },
      });
      if (!result.ok) {
        await failure(result);
        return;
      }
      setDeleteId(null);
      setRevision((v) => v + 1);
      await queryClient.invalidateQueries({ queryKey: ["jama-catalog"] });
      toast.success(action === "delete" ? "Oferta eliminada" : "Oferta actualizada");
    } catch {
      setError("No pudimos actualizar tu oferta. Inténtalo nuevamente.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  if (loading || !session || recovery)
    return (
      <AppShell>
        <p role="status" className="p-6">
          Comprobando tu sesión…
        </p>
      </AppShell>
    );
  return (
    <AppShell>
      <section className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <h1 className="flex items-center gap-2 text-2xl font-black sm:text-3xl">
          <Store className="shrink-0" />
          Mi negocio
        </h1>
        <p className="text-sm text-muted-foreground">
          Publica tus productos con descuento y recibe consultas por WhatsApp.
        </p>
        {error && (
          <div role="alert" className="rounded-xl bg-muted p-4 text-sm">
            <p>{error}</p>
            {!pending && (
              <button
                onClick={() => setRevision((v) => v + 1)}
                className="min-h-11 font-bold underline"
              >
                Volver a cargar
              </button>
            )}
          </div>
        )}
        {checking ? (
          <p role="status">Cargando tu negocio…</p>
        ) : loadedUser.current !== session.user.id ? null : (
          <>
            {!business || editingBusiness ? (
              <form
                onSubmit={submitBusiness}
                className="min-w-0 space-y-3 rounded-3xl bg-card p-4 shadow-soft sm:space-y-4 sm:p-5"
              >
                <h2 className="text-xl font-black">
                  {business ? "Editar negocio" : "Registra tu negocio"}
                </h2>
                <fieldset
                  disabled={pending}
                  className="min-w-0 space-y-3 disabled:opacity-60 sm:space-y-4"
                >
                  <label className="block space-y-1 text-sm font-bold">
                    Nombre del negocio
                    <input
                      required
                      minLength={3}
                      maxLength={120}
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className={sellerField}
                    />
                  </label>
                  <label className="block space-y-1 text-sm font-bold">
                    Dirección o zona
                    <input
                      required
                      minLength={3}
                      maxLength={200}
                      value={form.zone}
                      onChange={(e) => setForm({ ...form, zone: e.target.value })}
                      className={sellerField}
                    />
                  </label>
                  <label className="block space-y-1 text-sm font-bold">
                    Categoría del negocio
                    <select
                      required
                      aria-label="Categoría del negocio"
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className={sellerField}
                    >
                      <option value="">Selecciona una categoría</option>
                      {categories
                        .filter((c) => c.businessEnabled)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.emoji} {c.label}
                          </option>
                        ))}
                    </select>
                  </label>
                  {categoriesError && (
                    <p role="alert" className="text-sm">
                      {categoriesError}{" "}
                      <button
                        type="button"
                        onClick={() => void refreshCategories()}
                        className="underline"
                      >
                        Reintentar
                      </button>
                    </p>
                  )}
                  <label className="block space-y-1 text-sm font-bold">
                    WhatsApp del negocio (obligatorio)
                    <input
                      required
                      type="tel"
                      autoComplete="tel"
                      maxLength={30}
                      placeholder="+51 912 345 678"
                      value={form.whatsapp}
                      onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                      className={sellerField}
                    />
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Incluye el código de país (+51 en Perú). Este será tu contacto comercial: los
                    clientes podrán abrirlo en WhatsApp al solicitar un descuento. Usa un número con
                    WhatsApp activo.
                  </p>
                  <button
                    type="submit"
                    disabled={categoriesLoading || !!categoriesError}
                    className="press min-h-12 w-full rounded-full bg-lime px-4 font-black"
                  >
                    {pending ? "Guardando…" : "Guardar negocio"}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    Revisaremos si tu negocio es compatible con las ofertas de cierre. Cambiar sus
                    datos lo enviará nuevamente a revisión.
                  </p>
                  {business && (
                    <button
                      type="button"
                      onClick={() => setEditingBusiness(false)}
                      className="min-h-11 font-bold underline"
                    >
                      Cancelar
                    </button>
                  )}
                </fieldset>
              </form>
            ) : (
              <div className="space-y-2 rounded-3xl bg-card p-4 shadow-soft sm:p-5">
                <h2 className="text-xl font-black">{business.name}</h2>
                <p className="break-words text-sm">{business.zone}</p>
                <p className="text-sm">
                  {categories.find((c) => c.id === business.category)?.label ?? business.category}
                </p>
                <p className="text-sm">WhatsApp: +{business.whatsapp}</p>
                <div role="status" className="rounded-xl bg-muted p-3 text-sm">
                  <p className="font-bold">
                    {business.status === "approved"
                      ? "Negocio aprobado"
                      : business.status === "rejected"
                        ? "Solicitud no aprobada"
                        : "Solicitud en revisión"}
                  </p>
                  {business.status !== "approved" && (
                    <p>
                      Puedes preparar borradores. Tus ofertas estarán ocultas hasta que un
                      administrador apruebe el negocio.
                    </p>
                  )}
                  {business.review_note && (
                    <p className="mt-1 whitespace-pre-wrap break-words">{business.review_note}</p>
                  )}
                  <button
                    type="button"
                    disabled={pending || !!editor}
                    onClick={() => setRevision((v) => v + 1)}
                    className="min-h-11 font-bold underline"
                  >
                    Actualizar estado
                  </button>
                </div>
                <button
                  disabled={pending}
                  onClick={() => {
                    setEditingBusiness(true);
                    setEditor(null);
                  }}
                  className="min-h-11 font-bold underline"
                >
                  Editar negocio
                </button>
              </div>
            )}
            {business && !editingBusiness && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-2xl font-black">Mis ofertas</h2>
                  <button
                    disabled={pending || !!editor}
                    onClick={() => {
                      setEditor({ offer: null });
                      setError("");
                    }}
                    className="press min-h-12 rounded-full bg-lime px-5 font-black disabled:opacity-50"
                  >
                    {business.status === "approved" ? "Publicar una oferta" : "Preparar una oferta"}
                  </button>
                </div>
                {editor && (
                  <OfferForm
                    key={editor.offer?.id ?? "new"}
                    offer={editor.offer}
                    accessToken={session.access_token}
                    businessCategory={business.category}
                    canPublish={business.status === "approved"}
                    onCancel={() => setEditor(null)}
                    onSaved={() => {
                      setEditor(null);
                      setRevision((v) => v + 1);
                      toast.success(
                        business.status === "approved"
                          ? "Oferta guardada. Se mostrará durante su vigencia si está publicada."
                          : "Borrador guardado. Necesitas la aprobación del negocio para publicar.",
                      );
                    }}
                  />
                )}
                {!offers.length && !editor && (
                  <p className="rounded-2xl bg-muted p-5 text-sm">
                    Aún no tienes ofertas. Publica tu primer producto.
                  </p>
                )}
                <ul className="space-y-4">
                  {offers.map((offer) => {
                    const status = offerStatus(offer, clock.server + elapsed);
                    return (
                      <li key={offer.id} className="space-y-3 rounded-2xl bg-card p-4 shadow-soft">
                        <div className="flex items-start gap-3">
                          <img
                            src={imageUrl(offer.imagePath)}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            width={80}
                            height={80}
                            className="size-20 shrink-0 rounded-xl object-cover"
                          />
                          <div className="min-w-0">
                            <h3 className="break-words font-extrabold">{offer.name}</h3>
                            <span className="mt-1 inline-block rounded-full bg-muted px-2 py-1 text-xs font-bold">
                              {business.status !== "approved" && offer.published
                                ? "Oculta: negocio no aprobado"
                                : status}
                            </span>
                            <p className="mt-1 text-sm">
                              S/ {(offer.priceCents / 100).toFixed(2)} · {offer.stock} disponibles
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Hasta {formatOfferTime(offer.endsAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            disabled={pending}
                            onClick={() => {
                              setEditor({ offer });
                              setDeleteId(null);
                            }}
                            className="min-h-11 rounded-full border px-4 text-sm font-bold"
                          >
                            Editar
                          </button>
                          <button
                            disabled={
                              pending ||
                              (!offer.published && business.status !== "approved") ||
                              (!offer.published && (status === "Vencida" || status === "Agotada"))
                            }
                            onClick={() =>
                              void action(offer.id, offer.published ? "pause" : "activate")
                            }
                            className="min-h-11 rounded-full border px-4 text-sm font-bold disabled:opacity-50"
                          >
                            {offer.published ? "Pausar" : "Reactivar"}
                          </button>
                          <button
                            disabled={pending}
                            onClick={() => setDeleteId(offer.id)}
                            className="min-h-11 rounded-full border px-4 text-sm font-bold text-destructive"
                          >
                            Eliminar
                          </button>
                          <Link
                            to="/oferta/$id"
                            params={{ id: offer.id }}
                            className="inline-flex min-h-11 items-center px-2 text-sm font-bold underline"
                          >
                            Ver oferta
                          </Link>
                        </div>
                        {deleteId === offer.id && (
                          <div role="alert" className="rounded-xl bg-muted p-3 text-sm">
                            <p>
                              ¿Eliminar “{offer.name}”? Se retirará del catálogo y esta acción no se
                              puede deshacer.
                            </p>
                            <div className="mt-2 flex flex-wrap gap-3">
                              <button
                                disabled={pending}
                                onClick={() => void action(offer.id, "delete")}
                                className="min-h-11 rounded-full bg-destructive px-4 font-bold text-white"
                              >
                                Confirmar eliminación
                              </button>
                              <button
                                disabled={pending}
                                onClick={() => setDeleteId(null)}
                                className="min-h-11 font-bold"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </>
        )}
      </section>
    </AppShell>
  );
}
