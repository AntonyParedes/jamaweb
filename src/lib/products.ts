import heroAsset from "@/assets/jama-hero.webp.asset.json";
import tresLeches from "@/assets/p-tresleches.jpg";
import pan from "@/assets/p-pan.jpg";
import cupcakes from "@/assets/p-cupcakes.jpg";
import alfajores from "@/assets/p-alfajores.jpg";

export type Category = "tortas" | "panaderia" | "postres" | "otros";

export const CATEGORIES: { id: Category | "todos"; label: string; emoji: string }[] = [
  { id: "todos", label: "Todo", emoji: "✨" },
  { id: "tortas", label: "Tortas", emoji: "🍰" },
  { id: "panaderia", label: "Panadería", emoji: "🥐" },
  { id: "postres", label: "Postres", emoji: "🧁" },
  { id: "otros", label: "Otros", emoji: "🍪" },
];

export type Product = {
  id: string;
  name: string;
  store: string;
  zone: string;
  category: Category;
  image: string;
  price: number;
  originalPrice: number;
  madeAt: string;
  pickup: string;
  stock: number;
  includes?: string;
};

export function discountPercent(price: number, original: number): number {
  if (original <= 0 || price >= original) return 0;
  return Math.round((1 - price / original) * 100);
}

export const PRODUCTS: Product[] = [
  {
    id: "torta-chocolate",
    name: "Tajada de torta de chocolate",
    store: "Pastelería Dulce Hogar",
    zone: "Huamanga · Centro",
    category: "tortas",
    image: heroAsset.url,
    price: 15,
    originalPrice: 25,
    madeAt: "Hoy 8:00 am",
    pickup: "6:00 – 7:00 pm",
    stock: 4,
  },
  {
    id: "tres-leches",
    name: "Tres leches con fresas",
    store: "Pastelería Lalos",
    zone: "Huamanga · Fátima",
    category: "tortas",
    image: tresLeches,
    price: 9,
    originalPrice: 16,
    madeAt: "Hoy 9:30 am",
    pickup: "6:30 – 7:30 pm",
    stock: 6,
  },
  {
    id: "combo-pan",
    name: "Combo surtido de pan dulce",
    store: "Panadería San Juan",
    zone: "Huamanga · La Terraza",
    category: "panaderia",
    image: pan,
    price: 8,
    originalPrice: 14,
    madeAt: "Hoy 6:00 am",
    pickup: "6:00 – 7:00 pm",
    stock: 3,
    includes: "2 conchas, 2 croissants, 2 roscas",
  },
  {
    id: "cupcakes",
    name: "Pack de 3 cupcakes de frutas",
    store: "Dulce Hogar",
    zone: "Huamanga · Centro",
    category: "postres",
    image: cupcakes,
    price: 10,
    originalPrice: 18,
    madeAt: "Hoy 10:00 am",
    pickup: "6:00 – 7:00 pm",
    stock: 5,
    includes: "Fresa, frambuesa y arándano",
  },
  {
    id: "alfajores",
    name: "Caja de alfajores y galletas",
    store: "Panadería San Juan",
    zone: "Huamanga · La Terraza",
    category: "otros",
    image: alfajores,
    price: 7,
    originalPrice: 12,
    madeAt: "Hoy 7:30 am",
    pickup: "6:30 – 7:30 pm",
    stock: 8,
    includes: "6 alfajores + galletas de mantequilla",
  },
];
