import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, BadgePercent, CalendarCheck, MapPin, Search, ShieldCheck, ShoppingBag, Store } from "lucide-react";
import heroAsset from "@/assets/jama-hero.webp.asset.json";
import { AppShell } from "@/components/jama/AppShell";
import { ProductGrid } from "@/components/jama/ProductCard";
import { ProductSheet } from "@/components/jama/ProductSheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PRODUCTS, type Product } from "@/lib/products";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JAMA — Comida rica de hoy, más barata" },
      { name: "description", content: "Ofertas de cierre de pastelerías y panaderías de Ayacucho. Reserva y recoge hoy." },
      { property: "og:title", content: "JAMA — Comida rica de hoy, más barata" },
      { property: "og:description", content: "Ofertas frescas cerca de ti. Reserva y recoge hoy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const STEPS = [
  { icon: Search, label: "Buscar" },
  { icon: ShoppingBag, label: "Reservar" },
  { icon: MapPin, label: "Recoger" },
];
const TRUST = [
  { icon: CalendarCheck, label: "Fresco hoy" },
  { icon: BadgePercent, label: "Precio claro" },
  { icon: ShieldCheck, label: "Recojo local" },
];
const FAQ = [
  { q: "¿Es producto del día?", a: "Sí. Solo ofertas elaboradas hoy, con foto real y hora visible." },
  { q: "¿Cómo pago?", a: "Al recoger o por Yape. El precio de carta siempre está visible." },
  { q: "¿A qué hora recojo?", a: "En la ventana del local, normalmente entre 6:00 y 7:30 pm." },
  { q: "¿Qué pasa con lo que no se vende?", a: "Se dona a comedores aliados. Aquí nada bueno se bota." },
];

function Home() {
  const [open, setOpen] = useState<Product | null>(null);
  return (
    <AppShell>
      <section className="mx-auto grid max-w-6xl items-center gap-4 px-4 pt-4 md:grid-cols-2 md:gap-10 md:pt-12">
        <div className="order-2 md:order-1">
          <h1 className="text-4xl font-black leading-[1.05] tracking-tight md:text-6xl">
            Comida rica, <span className="rounded-xl bg-lime px-2">más barata.</span>
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">Ofertas frescas cerca de ti.</p>
          <Link
            to="/explorar"
            className="press mt-5 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-navy px-7 py-3.5 text-lg font-black text-navy-foreground sm:w-auto"
          >
            Explorar ofertas <ArrowRight className="size-5" />
          </Link>
        </div>
        <img
          src={heroAsset.url}
          alt="Torta de chocolate a S/ 15 en lugar de S/ 25 reservada con JAMA"
          width={960}
          height={960}
          fetchPriority="high"
          className="order-1 mx-auto aspect-square w-full max-w-md object-contain md:order-2 md:max-w-none"
        />
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-6">
        <ul className="grid grid-cols-3 gap-2">
          {TRUST.map(({ icon: Icon, label }) => (
            <li key={label} className="flex flex-col items-center gap-1.5 rounded-2xl bg-card p-3 text-center shadow-soft">
              <Icon className="size-6" />
              <span className="text-xs font-extrabold md:text-sm">{label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-10">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-2xl font-black">Ofertas de hoy</h2>
          <Link to="/explorar" className="flex min-h-11 items-center gap-1 text-sm font-bold">
            Ver todo <ArrowRight className="size-4" />
          </Link>
        </div>
        <ProductGrid products={PRODUCTS.slice(0, 4)} onOpen={setOpen} />
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-12">
        <h2 className="mb-4 text-2xl font-black">Así de fácil</h2>
        <ol className="grid grid-cols-3 gap-2">
          {STEPS.map(({ icon: Icon, label }, i) => (
            <li key={label} className="flex flex-col items-center gap-2 text-center">
              <span className="grid size-16 place-items-center rounded-3xl bg-lime text-lime-foreground md:size-20">
                <Icon className="size-7" />
              </span>
              <span className="text-sm font-extrabold">{i + 1}. {label}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-12">
        <div className="flex flex-col items-start gap-4 rounded-3xl bg-navy p-6 text-navy-foreground md:flex-row md:items-center md:justify-between md:p-10">
          <div className="flex items-center gap-3">
            <Store className="size-8 shrink-0 text-lime" />
            <h2 className="text-2xl font-black">¿Tienes una panadería?</h2>
          </div>
          <a
            href="mailto:hola@jama.pe?subject=Quiero%20publicar%20con%20JAMA"
            className="press inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-lime px-6 font-black text-lime-foreground md:w-auto"
          >
            Publica con JAMA <ArrowRight className="size-5" />
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pt-12">
        <h2 className="mb-2 text-2xl font-black">Preguntas</h2>
        <Accordion type="single" collapsible>
          {FAQ.map((f) => (
            <AccordionItem key={f.q} value={f.q}>
              <AccordionTrigger className="min-h-12 text-base font-bold">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <footer className="mx-auto max-w-6xl px-4 pt-12 text-center">
        <p className="text-lg font-black">Comida rica de hoy, más barata y cerca de ti.</p>
        <p className="mt-1 text-xs text-muted-foreground">JAMA · Huamanga, Ayacucho</p>
      </footer>

      <ProductSheet product={open} onClose={() => setOpen(null)} />
    </AppShell>
  );
}
