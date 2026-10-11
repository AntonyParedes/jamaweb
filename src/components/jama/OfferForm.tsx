import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  IMAGE_BUCKET,
  fromLimaInput,
  imageExtension,
  limaInput,
  offerSchema,
  parsePrice,
  type SellerOffer,
} from "@/lib/offers";
import { imageUrl } from "@/lib/offers-service";
import { saveOffer } from "@/lib/offers-api";
import { getSupabase } from "@/lib/supabase";
import { useCategories } from "@/lib/categories";

export const sellerField =
  "min-h-11 w-full min-w-0 rounded-xl border bg-card px-3 text-base outline-none focus:ring-2 focus:ring-ring sm:min-h-12";
class FormError extends Error {}
export function OfferForm({
  offer,
  accessToken,
  onSaved,
  onCancel,
  businessCategory,
  canPublish,
}: {
  offer: SellerOffer | null;
  accessToken: string;
  onSaved: () => void;
  onCancel: () => void;
  businessCategory: string;
  canPublish: boolean;
}) {
  const queryClient = useQueryClient();
  const {
    categories,
    loading: categoriesLoading,
    error: categoriesError,
    refresh: refreshCategories,
  } = useCategories();
  const [id] = useState(() => offer?.id ?? crypto.randomUUID());
  const [name, setName] = useState(offer?.name ?? "");
  const [description, setDescription] = useState(offer?.description ?? "");
  const [category, setCategory] = useState(offer?.category ?? businessCategory);
  const [normalPrice, setNormalPrice] = useState(
    offer ? (offer.originalPriceCents / 100).toFixed(2) : "",
  );
  const [price, setPrice] = useState(offer ? (offer.priceCents / 100).toFixed(2) : "");
  const [stock, setStock] = useState(String(offer?.stock ?? 1));
  const [starts, setStarts] = useState(limaInput(offer?.startsAt ?? new Date().toISOString()));
  const [ends, setEnds] = useState(offer ? limaInput(offer.endsAt) : "");
  const [published, setPublished] = useState(canPublish && (offer?.published ?? true));
  const definition = categories.find((c) => c.id === category && c.offerEnabled);
  useEffect(() => {
    if (!canPublish) setPublished(false);
  }, [canPublish]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(offer ? imageUrl(offer.imagePath) : "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [stage, setStage] = useState("");
  const busy = useRef(false);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    setError("");
    let newPath: string | null = null;
    const client = getSupabase();
    busy.current = true;
    setPending(true);
    try {
      if (!definition) throw new FormError("Selecciona una categoría de oferta disponible.");
      let originalPriceCents: number, priceCents: number, startsAt: string, endsAt: string;
      try {
        originalPriceCents = parsePrice(normalPrice);
        priceCents = parsePrice(price);
        startsAt = fromLimaInput(starts);
        endsAt = fromLimaInput(ends);
        if (file) imageExtension(file);
      } catch (err) {
        throw new FormError((err as Error).message);
      }
      const parsed = offerSchema.safeParse({
        id,
        name,
        description,
        category,
        originalPriceCents,
        priceCents,
        stock: Number(stock),
        startsAt,
        endsAt,
      });
      if (!parsed.success)
        throw new FormError(parsed.error.issues[0]?.message ?? "Revisa los datos del producto.");
      if (!file && !offer?.imagePath) throw new FormError("Selecciona una foto para publicar.");
      if (!client) throw new FormError("El acceso a cuentas no está disponible.");
      setStage("Verificando tu sesión…");
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || !auth.user) throw new FormError("Inicia sesión nuevamente para publicar.");
      let path = offer?.imagePath ?? "";
      if (file) {
        const extension = imageExtension(file);
        newPath = `${auth.user.id}/${id}/${crypto.randomUUID()}.${extension}`;
        setStage("Subiendo la foto…");
        const { error: uploadError } = await client.storage
          .from(IMAGE_BUCKET)
          .upload(newPath, file, { contentType: file.type, upsert: false });
        if (uploadError)
          throw new FormError("No pudimos subir la foto. Revisa el formato y vuelve a intentarlo.");
        path = newPath;
      }
      setStage("Verificando y guardando la oferta…");
      const result = await saveOffer({
        data: { accessToken, offer: parsed.data, imagePath: path, published },
      });
      if (!result.ok) throw new FormError(result.message);
      newPath = null;
      await queryClient.invalidateQueries({ queryKey: ["jama-catalog"] });
      onSaved();
    } catch (err) {
      // The delete policy protects any file whose offer was already saved,
      // including a successful save whose network response was lost.
      if (newPath && client) {
        try {
          await client.storage.from(IMAGE_BUCKET).remove([newPath]);
        } catch {
          /* A retry can use a fresh object. */
        }
      }
      setError(
        err instanceof FormError
          ? err.message
          : "No pudimos guardar la oferta. Inténtalo nuevamente.",
      );
    } finally {
      busy.current = false;
      setPending(false);
      setStage("");
    }
  }
  return (
    <form
      onSubmit={submit}
      className="min-w-0 space-y-3 rounded-3xl bg-card p-4 shadow-soft sm:space-y-4 sm:p-5"
    >
      <h2 className="text-xl font-black">{offer ? "Editar oferta" : "Nueva oferta"}</h2>
      {categoriesError && (
        <p role="alert" className="text-sm">
          {categoriesError}{" "}
          <button type="button" onClick={() => void refreshCategories()} className="underline">
            Reintentar
          </button>
        </p>
      )}
      <fieldset
        disabled={pending || categoriesLoading || !!categoriesError}
        className="min-w-0 space-y-3 disabled:opacity-60 sm:space-y-4"
      >
        <label className="block space-y-1 text-sm font-bold">
          {definition?.nameLabel ?? "Nombre del producto"}
          <input
            required
            minLength={3}
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={sellerField}
          />
        </label>
        <label className="block space-y-1 text-sm font-bold">
          Descripción
          <textarea
            required
            minLength={3}
            maxLength={2000}
            rows={3}
            placeholder={definition?.descriptionHint}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${sellerField} py-3`}
          />
        </label>
        {definition?.descriptionHint && (
          <p className="text-xs text-muted-foreground">{definition.descriptionHint}</p>
        )}
        <label className="block space-y-1 text-sm font-bold">
          Categoría
          <select
            aria-label="Categoría"
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
            className={sellerField}
          >
            {!definition && <option value="">Selecciona una categoría disponible</option>}
            {categories
              .filter((c) => c.offerEnabled)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.label}
                </option>
              ))}
          </select>
        </label>
        <label className="block min-w-0 space-y-1 text-sm font-bold">
          Foto del producto
          <input
            type="file"
            required={!offer?.imagePath}
            accept="image/jpeg,image/png,image/webp"
            className="block min-h-12 w-full min-w-0 max-w-full text-sm file:mr-2 file:rounded-full file:border-0 file:bg-muted file:px-3 file:py-3 file:font-bold"
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (!selected) return;
              try {
                imageExtension(selected);
                setFile(selected);
                setError("");
              } catch (err) {
                e.target.value = "";
                setFile(null);
                setPreview(offer ? imageUrl(offer.imagePath) : "");
                setError((err as Error).message);
              }
            }}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          JPEG, PNG o WebP. Máximo 5 MB. La foto será pública.
        </p>
        {preview && (
          <img
            src={preview}
            alt="Vista previa del producto"
            className="aspect-[4/3] max-h-48 w-full rounded-2xl object-cover sm:max-h-none"
          />
        )}
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="block min-w-0 space-y-1 text-sm font-bold">
            Precio normal (S/)
            <input
              required
              type="text"
              inputMode="decimal"
              value={normalPrice}
              onChange={(e) => setNormalPrice(e.target.value)}
              className={sellerField}
            />
          </label>
          <label className="block min-w-0 space-y-1 text-sm font-bold">
            Precio con descuento (S/)
            <input
              required
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={sellerField}
            />
          </label>
        </div>
        <label className="block space-y-1 text-sm font-bold">
          Cantidad disponible
          <input
            required
            type="number"
            min={1}
            max={100000}
            step={1}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className={sellerField}
          />
        </label>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="block min-w-0 space-y-1 text-sm font-bold">
            Inicio del descuento
            <input
              required
              type="datetime-local"
              value={starts}
              onChange={(e) => setStarts(e.target.value)}
              className={sellerField}
            />
          </label>
          <label className="block min-w-0 space-y-1 text-sm font-bold">
            Fin del descuento
            <input
              required
              type="datetime-local"
              value={ends}
              onChange={(e) => setEnds(e.target.value)}
              className={sellerField}
            />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          Horarios de Perú (America/Lima). Si el inicio es futuro, la oferta aparecerá a esa hora.
        </p>
        <label className="flex min-h-11 items-center gap-3 text-sm font-bold">
          <input
            type="checkbox"
            checked={published}
            disabled={!canPublish}
            onChange={(e) => setPublished(e.target.checked)}
            className="size-5"
          />
          {canPublish
            ? "Publicar según la vigencia indicada"
            : "Borrador: publicación del negocio suspendida"}
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="press min-h-12 flex-1 rounded-full bg-lime px-5 font-black"
          >
            {pending ? "Guardando…" : "Guardar oferta"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-12 rounded-full border px-5 font-bold"
          >
            Cancelar
          </button>
        </div>
      </fieldset>
      {stage && (
        <p role="status" className="text-sm">
          {stage}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
