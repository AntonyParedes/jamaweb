import type { Product } from "./products";
import photoSheet from "@/assets/jama-demo-foods.png";

// Explicit examples only: never part of Supabase's real catalog or checkout.
const examples: [string, string, number, number, string][] = [
  ["Arroz con pollo", "restaurantes", 10, 18, "Arroz verde con pollo y ensalada."],
  ["Lomo saltado", "restaurantes", 15, 25, "Carne salteada, papas fritas y arroz."],
  ["Ají de gallina", "restaurantes", 10, 18, "Pollo en salsa cremosa con arroz y papa."],
  ["Milanesa de pollo", "restaurantes", 11, 20, "Milanesa acompañada de arroz y ensalada."],
  ["Tallarines rojos", "restaurantes", 9, 16, "Pasta con salsa de tomate."],
  ["Torta de chocolate", "tortas", 7, 12, "Una porción de torta de chocolate."],
  ["Torta tres leches", "tortas", 7, 12, "Una porción de bizcocho con tres leches."],
  ["Cheesecake de fresa", "tortas", 8, 14, "Una porción con cobertura de fresas."],
  ["Torta de zanahoria", "tortas", 7, 12, "Una porción de torta de zanahoria."],
  ["Pie de limón", "postres", 6, 10, "Una porción de pie de limón."],
  ["Alfajores", "postres", 5, 9, "Alfajores con manjar y azúcar en polvo."],
  ["Brownies", "postres", 5, 9, "Brownies de chocolate."],
  ["Cupcakes surtidos", "postres", 6, 11, "Cupcakes con distintas coberturas."],
  ["Arroz con leche", "postres", 4, 7, "Postre cremoso de arroz con leche."],
  ["Mazamorra morada", "postres", 4, 7, "Postre tradicional de maíz morado."],
  ["Panecillos surtidos", "panaderia", 4, 7, "Una selección de panes."],
  ["Empanadas al horno", "panaderia", 6, 10, "Empanadas recién horneadas."],
  ["Sándwich de pollo", "cafeteria", 7, 12, "Pan relleno con pollo y vegetales."],
  ["Ensalada fresca", "alimentos", 8, 14, "Una ensalada de vegetales variados."],
  ["Ensalada de frutas", "alimentos", 6, 10, "Una mezcla de frutas de temporada."],
];

// The generated sheet has unequal row heights; use its actual photo boundaries.
const columns: [number, number][] = [
  [0, 281],
  [285, 560],
  [564, 839],
  [843, 1119],
  [1123, 1402],
];
const rows: [number, number][] = [
  [0, 274],
  [277, 542],
  [545, 812],
  [815, 1122],
];
function photoTile(index: number): NonNullable<Product["imageTile"]> {
  const column = columns[index % 5];
  const row = rows[Math.floor(index / 5)];
  if (!column || !row) throw new Error("Missing example photo bounds");
  return {
    left: column[0],
    top: row[0],
    width: column[1] - column[0],
    height: row[1] - row[0],
    sheetWidth: 1402,
    sheetHeight: 1122,
  };
}
export const demoProducts: Product[] = examples.map(
  ([name, category, price, originalPrice, description], index) => ({
    id: `demo-${index + 1}`,
    name,
    category,
    price,
    originalPrice,
    description,
    store: "Local de demostración",
    zone: "Sin dirección comercial",
    image: photoSheet,
    imageTile: photoTile(index),
    demo: true,
    stock: 0,
    startsAt: "",
    endsAt: "",
  }),
);
