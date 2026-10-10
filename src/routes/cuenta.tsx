import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Clock3, ShoppingBag, Store, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/jama/AppShell";
import { PRODUCTS } from "@/lib/products";
import { cancelReservation, saveProfile, useJama } from "@/lib/store";

export const Route = createFileRoute("/cuenta")({
  head: () => ({
    meta: [
      { title: "Mi cuenta — JAMA" },
      { name: "description", content: "Tus reservas y datos de contacto en JAMA." },
      { property: "og:title", content: "Mi cuenta — JAMA" },
      { property: "og:description", content: "Tus reservas y datos en JAMA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Cuenta,
});

function Cuenta() {
  const { reservations, profile } = useJama();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  useEffect(() => {
    setName(profile.name);
    setPhone(profile.phone);
  }, [profile.name, profile.phone]);

  return (
    <AppShell>
      <section className="mx-auto max-w-2xl space-y-8 px-4 pt-5">
        <h1 className="text-3xl font-black">Mi cuenta</h1>

        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-black"><ShoppingBag className="size-5" /> Mis reservas</h2>
          {reservations.length ? (
            <ul className="space-y-2">
              {reservations.map((r) => {
                const p = PRODUCTS.find((x) => x.id === r.productId);
                if (!p) return null;
                return (
                  <li key={r.id} className="flex items-center gap-3 rounded-2xl bg-card p-2 shadow-soft">
                    <img src={p.image} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-extrabold">{r.qty}× {p.name}</p>
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground"><Store className="size-3.5 shrink-0" />{p.store}</p>
                      <p className="flex items-center gap-1 text-xs font-bold"><Clock3 className="size-3.5 shrink-0" />{p.pickup} · S/ {p.price * r.qty}</p>
                    </div>
                    <button
                      aria-label="Cancelar reserva"
                      onClick={() => { cancelReservation(r.id); toast("Reserva cancelada"); }}
                      className="press grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground"
                    >
                      <X className="size-5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Link to="/explorar" className="press flex min-h-14 items-center justify-between rounded-2xl bg-card px-4 font-bold shadow-soft">
              Sin reservas aún · Explorar <ArrowRight className="size-4" />
            </Link>
          )}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); saveProfile({ name: name.trim(), phone: phone.replace(/\s/g, "") }); toast.success("Datos guardados"); }}
          className="space-y-3"
        >
          <h2 className="flex items-center gap-2 text-lg font-black"><UserRound className="size-5" /> Mis datos</h2>
          <input autoComplete="name" placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)}
            className="min-h-12 w-full rounded-xl border bg-card px-4 text-base outline-none focus:ring-2 focus:ring-ring" />
          <input type="tel" inputMode="numeric" autoComplete="tel" placeholder="WhatsApp (9 dígitos)" value={phone} onChange={(e) => setPhone(e.target.value)}
            className="min-h-12 w-full rounded-xl border bg-card px-4 text-base outline-none focus:ring-2 focus:ring-ring" />
          <button type="submit" className="press min-h-12 w-full rounded-full bg-lime font-black text-lime-foreground">Guardar</button>
          <p className="text-center text-xs text-muted-foreground">Se guardan solo en este celular.</p>
        </form>
      </section>
    </AppShell>
  );
}
