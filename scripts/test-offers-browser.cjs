// Optional browser smoke test. Requires Playwright, Chromium and a local Vite server.
// Auth, Storage, server functions and WhatsApp are intercepted; no real accounts or messages.
const { chromium } = require(process.env.JAMA_PLAYWRIGHT_MODULE || "playwright");
const { fromJSON } = require("seroval");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const base = process.env.JAMA_TEST_BASE_URL || "http://127.0.0.1:3000";
assert.ok(
  ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
  "Use a local development server for these mocked tests.",
);
const supabaseOrigin = process.env.JAMA_SUPABASE_URL || "https://qzsmhpjjejnrwolackgz.supabase.co";
const uid = "00000000-0000-4000-8000-000000000001";
const user = {
  id: uid,
  aud: "authenticated",
  role: "authenticated",
  email: "seller@example.com",
  email_confirmed_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "Ana Vendedora" },
  identities: [],
};
const categories = [
  ["tortas", "Tortas", false, "Nombre del producto", "Indica porción e ingredientes."],
  ["panaderia", "Panadería", true, "Nombre del producto", "Indica unidades y elaboración."],
  ["postres", "Postres", false, "Nombre del producto", "Indica conservación."],
  [
    "cafeteria",
    "Cafeterías",
    true,
    "Nombre del producto o combo",
    "Describe los productos incluidos y tamaños.",
  ],
  [
    "restaurantes",
    "Restaurantes",
    true,
    "Nombre del plato o combo",
    "Indica acompañamientos y conservación.",
  ],
  ["alimentos", "Tiendas de alimentos", true, "Nombre del producto", "Indica peso y conservación."],
  [
    "otros",
    "Otros comercios compatibles",
    true,
    "Nombre del producto",
    "Describe la oferta de cierre.",
  ],
  ["mercado_local", "Mercado local nuevo", true, "Nombre de la canasta", "Indica el peso."],
].map(([id, label, businessEnabled, nameLabel, descriptionHint]) => ({
  id,
  label,
  businessEnabled,
  nameLabel,
  descriptionHint,
  offerEnabled: true,
  emoji: "🏷️",
}));
const picture = fs.readFileSync(
  require("node:path").join(__dirname, "../src/assets/jama-hero.png"),
);
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  let checks = 0;
  try {
    for (const width of [320, 375, 768, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 844 } });
      const page = await context.newPage();
      page.setDefaultTimeout(12000);
      page.setDefaultNavigationTimeout(20000);
      const errors = [];
      const calls = {};
      let business = null,
        offers = [],
        lastUpload = "",
        contactUrl = "";
      let isAdmin = false;
      page.on("pageerror", (error) => errors.push(error.message));
      await context.route(supabaseOrigin + "/**", async (route) => {
        const r = route.request(),
          path = new URL(r.url()).pathname;
        if (path.endsWith("/token") || path.endsWith("/signup"))
          return route.fulfill({
            json: {
              access_token: "synthetic-token",
              refresh_token: "synthetic-refresh",
              token_type: "bearer",
              expires_in: 3600,
              user,
            },
          });
        if (path.endsWith("/user")) return route.fulfill({ json: user });
        if (path.endsWith("/logout")) return route.fulfill({ status: 204 });
        if (path.endsWith("/profiles"))
          return route.fulfill({ json: { id: uid, full_name: "Ana Vendedora", phone: null } });
        if (path.includes("/storage/v1/object/public/"))
          return route.fulfill({ contentType: "image/png", body: picture });
        if (path.includes("/storage/v1/object/offer-images/") && r.method() === "POST") {
          lastUpload = decodeURIComponent(path.split("/offer-images/")[1]);
          return route.fulfill({ json: { Id: "image-id", Key: "offer-images/" + lastUpload } });
        }
        if (path.endsWith("/storage/v1/object/offer-images") && r.method() === "DELETE")
          return route.fulfill({ json: [] });
        return route.fulfill({ status: 404, json: { message: "Not mocked" } });
      });
      await context.route("**/_serverFn/**", async (route) => {
        const r = route.request();
        const encoded = new URL(r.url()).pathname.split("/_serverFn/")[1];
        const name = JSON.parse(Buffer.from(encoded, "base64url").toString()).export.split(
          "_createServerFn",
        )[0];
        calls[name] = (calls[name] || 0) + 1;
        let data = {};
        if (r.postData()) {
          const payload = JSON.parse(r.postData());
          data = fromJSON(payload).data || {};
        }
        let value;
        if (name === "fetchCategories") value = categories;
        else if (name === "fetchAdminAccess") value = isAdmin;
        else if (name === "fetchBusinessReviews" && !isAdmin)
          return route.fulfill({
            json: {
              result: {
                ok: false,
                reason: "validation",
                message: "No tienes permisos para revisar negocios.",
              },
              context: {},
            },
          });
        else if (name === "fetchBusinessReviews")
          value = business
            ? [{ ...business, created_at: new Date().toISOString(), reviewed_at: null }]
            : [];
        else if (name === "reviewBusiness") {
          business = { ...business, status: data.decision, review_note: data.note };
          value = { id: business.id };
        } else if (name === "fetchCatalog")
          value = {
            serverNow: new Date().toISOString(),
            items: offers
              .filter(
                (p) =>
                  p.published &&
                  business?.status === "approved" &&
                  p.stock > 0 &&
                  Date.parse(p.startsAt) <= Date.now() &&
                  Date.parse(p.endsAt) > Date.now(),
              )
              .map((p) => ({
                id: p.id,
                name: p.name,
                description: p.description,
                category: p.category,
                price: p.priceCents / 100,
                originalPrice: p.originalPriceCents / 100,
                stock: p.stock,
                startsAt: p.startsAt,
                endsAt: p.endsAt,
                store: business.name,
                zone: business.zone,
                image: supabaseOrigin + "/storage/v1/object/public/offer-images/" + p.imagePath,
              })),
          };
        else if (name === "fetchSeller")
          value = { business, offers, serverNow: new Date().toISOString() };
        else if (name === "saveBusiness") {
          business = {
            id: "00000000-0000-4000-8000-000000000011",
            status: "approved",
            review_note: "",
            ...data.business,
          };
          value = business;
        } else if (name === "saveOffer") {
          assert.equal(data.imagePath, lastUpload);
          const p = { ...data.offer, imagePath: data.imagePath, published: data.published };
          offers = offers.filter((o) => o.id !== p.id).concat(p);
          value = { id: p.id };
        } else if (name === "changeOffer") {
          if (data.action === "delete") offers = offers.filter((p) => p.id !== data.offerId);
          else
            offers = offers.map((p) =>
              p.id === data.offerId ? { ...p, published: data.action === "activate" } : p,
            );
          value = { id: data.offerId };
        } else if (name === "contactOffer") {
          value = {
            url:
              "https://wa.me/51912345678?text=" +
              encodeURIComponent(
                "Hola, vengo de JAMA y quisiera aprovechar el descuento de Torta de prueba a S/ 15.00. ¿Sigue disponible?",
              ),
            endsAt: offers[0].endsAt,
            serverNow: new Date().toISOString(),
          };
        } else throw Error("Unexpected server function " + name);
        return route.fulfill({ json: { result: { ok: true, value }, context: {} } });
      });
      await context.route("https://wa.me/**", async (route) => {
        contactUrl = route.request().url();
        await route.fulfill({ contentType: "text/html", body: "<p>WhatsApp simulated</p>" });
      });
      await page.goto(base + "/explorar");
      await page.waitForLoadState("networkidle");
      await page.getByText("20 ejemplos", { exact: true }).waitFor();
      assert.equal(await page.locator("article").count(), 20);
      await page
        .locator("article img")
        .first()
        .evaluate((image) => image.decode());
      checks++;
      await page.getByRole("button", { name: "Ver Arroz con pollo", exact: true }).click();
      const demoDialog = page.getByRole("dialog");
      await demoDialog
        .getByText("Ejemplo de demostración con foto ilustrativa.", { exact: false })
        .waitFor();
      assert.equal(await demoDialog.getByText("Quiero este descuento", { exact: true }).count(), 0);
      assert.equal(await demoDialog.getByRole("button", { name: /Agregar al carrito/ }).count(), 0);
      assert.equal(calls.contactOffer || 0, 0);
      await page.getByRole("button", { name: "Cerrar ejemplo" }).click();
      checks++;
      await page.getByPlaceholder("Busca productos, platos, locales…").fill("brownies");
      await page.getByText("1 ejemplo", { exact: true }).waitFor();
      assert.equal(await page.locator("article").count(), 1);
      await page.getByPlaceholder("Busca productos, platos, locales…").fill("");
      await page.getByRole("button", { name: /Tortas$/ }).click();
      await page.getByText("4 ejemplos", { exact: true }).waitFor();
      await page.getByRole("button", { name: "✨ Todo", exact: true }).click();
      checks++;
      await page.screenshot({ path: `/tmp/jama-examples-${width}.png`, fullPage: true });
      checks++;
      await page.getByRole("link", { name: "Publicar una oferta", exact: true }).click();
      await page.waitForURL("**/acceso?**");
      assert.equal(new URL(page.url()).searchParams.get("next"), "/vender");
      checks++;
      const inputMetrics = await page.getByLabel("Correo electrónico").evaluate((element) => ({
        size: parseFloat(getComputedStyle(element).fontSize),
        height: element.getBoundingClientRect().height,
        right: element.getBoundingClientRect().right,
      }));
      assert.ok(
        inputMetrics.size >= 16 && inputMetrics.height >= 44 && inputMetrics.right <= width,
      );
      checks++;
      await page.getByLabel("Correo electrónico").fill(user.email);
      await page.getByLabel("Contraseña", { exact: true }).fill("synthetic-password");
      await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
      await page.waitForURL(base + "/");
      await page.getByRole("link", { name: "Publicar una oferta", exact: true }).first().click();
      await page.waitForURL("**/vender");
      await page.getByRole("heading", { name: "Registra tu negocio" }).waitFor();
      checks++;
      await page.getByLabel("Nombre del negocio", { exact: true }).fill("Pastelería de prueba");
      await page.getByLabel("Dirección o zona").fill("Centro de Huamanga");
      await page.getByLabel("Categoría del negocio", { exact: true }).selectOption("cafeteria");
      assert.ok(
        await page
          .getByLabel("Categoría del negocio")
          .locator('option[value="mercado_local"]')
          .count(),
      );
      checks++;
      await page.getByLabel("WhatsApp del negocio (obligatorio)").fill("+51 123");
      await page.getByRole("button", { name: "Guardar negocio" }).click();
      await page.getByRole("alert").filter({ hasText: "Revisa el WhatsApp" }).waitFor();
      assert.equal(calls.saveBusiness || 0, 0);
      checks++;
      await page.getByLabel("WhatsApp del negocio (obligatorio)").fill("+51 912 345 678");
      await page.getByRole("button", { name: "Guardar negocio" }).click();
      await page.getByRole("heading", { name: "Mis ofertas" }).waitFor();
      checks++;
      await page.getByText("Publicación habilitada", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Publicar una oferta", exact: true }).click();
      await page.getByLabel("Nombre del producto o combo", { exact: true }).waitFor();
      await page.getByPlaceholder("Describe los productos incluidos y tamaños.").waitFor();
      assert.equal(await page.getByRole("checkbox").isDisabled(), false);
      assert.equal(await page.getByRole("checkbox").isChecked(), true);
      checks++;
      await page.getByLabel("Categoría", { exact: true }).selectOption("tortas");
      await page.getByLabel("Nombre del producto", { exact: true }).fill("Torta de prueba");
      await page.getByLabel("Descripción", { exact: true }).fill("Una porción fresca de chocolate");
      await page.getByLabel("Categoría", { exact: true }).selectOption("tortas");
      await page
        .getByLabel("Foto del producto")
        .setInputFiles({ name: "producto.png", mimeType: "image/png", buffer: picture });
      await page.getByAltText("Vista previa del producto").waitFor();
      checks++;
      await page.getByLabel("Precio normal (S/)").fill("25");
      await page.getByLabel("Precio con descuento (S/)").fill("25");
      await page.getByLabel("Cantidad disponible").fill("4");
      const ends = new Date(Date.now() + 7200000 - 5 * 3600000).toISOString().slice(0, 16);
      await page.getByLabel("Fin del descuento").fill(ends);
      await page.getByRole("button", { name: "Guardar oferta" }).click();
      await page.getByRole("alert").filter({ hasText: "descuento debe ser menor" }).waitFor();
      assert.equal(calls.saveOffer || 0, 0);
      checks++;
      await page.getByLabel("Precio con descuento (S/)").fill("15");
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        true,
      );
      checks++;
      await page.getByRole("button", { name: "Guardar oferta" }).click();
      await page.getByRole("heading", { name: "Torta de prueba", exact: true }).waitFor();
      assert.equal(calls.saveOffer, 1);
      checks++;
      assert.equal(offers[0].published, true);
      assert.equal(
        await page.getByRole("button", { name: "Pausar", exact: true }).isDisabled(),
        false,
      );
      checks++;
      await page.goto(base + "/explorar");
      await page.getByRole("button", { name: "Ver Torta de prueba", exact: true }).waitFor();
      assert.equal(
        await page.getByRole("heading", { name: "Ejemplos de ofertas", exact: true }).count(),
        1,
      );
      checks++;
      await page.goto(base + "/administracion");
      await page.getByRole("alert").filter({ hasText: "No tienes permisos" }).waitFor();
      assert.equal(
        await page.getByRole("button", { name: "Habilitar publicación", exact: true }).count(),
        0,
      );
      checks++;
      isAdmin = true;
      await page.getByRole("button", { name: "Reintentar", exact: true }).click();
      await page.getByRole("heading", { name: "Pastelería de prueba", exact: true }).waitFor();
      await page.screenshot({ path: `/tmp/jama-review-${width}.png`, fullPage: true });
      await page.getByRole("button", { name: "Suspender", exact: true }).click();
      await page.getByText("Revisión guardada.").waitFor();
      assert.equal(business.status, "pending");
      await page.getByRole("button", { name: "Habilitar publicación", exact: true }).click();
      await page.getByText("Revisión guardada.").waitFor();
      assert.equal(business.status, "approved");
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        true,
      );
      checks++;
      await page.screenshot({ path: `/tmp/jama-approval-${width}.png`, fullPage: true });
      await page.goto(base + "/vender");
      await page.getByText("Publicación habilitada", { exact: true }).waitFor();
      await page.getByText("Activa", { exact: true }).waitFor();
      checks++;
      await page.getByRole("button", { name: "Pausar", exact: true }).click();
      await page.getByText("Pausada", { exact: true }).waitFor();
      checks++;
      await page.getByRole("button", { name: "Publicar", exact: true }).click();
      await page.getByText("Activa", { exact: true }).waitFor();
      checks++;
      await page.goto(base + "/explorar");
      await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: "Ver Torta de prueba", exact: true }).click();
      await page.getByRole("link", { name: "Quiero este descuento", exact: true }).click();
      await page.getByRole("heading", { name: "Torta de prueba", exact: true }).waitFor();
      checks++;
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        true,
      );
      checks++;
      const id = offers[0].id;
      await page.goto(base + "/cuenta");
      await page.getByRole("button", { name: "Cerrar sesión" }).click();
      await page.getByRole("link", { name: "Iniciar sesión", exact: true }).waitFor();
      await page.goto(base + "/oferta/" + id);
      await page.getByRole("button", { name: "Quiero este descuento", exact: true }).click();
      await page.waitForURL("**/acceso?**");
      assert.equal(new URL(page.url()).searchParams.get("next"), "/oferta/" + id);
      assert.equal(calls.contactOffer || 0, 0);
      checks++;
      await page.getByLabel("Correo electrónico").fill(user.email);
      await page.getByLabel("Contraseña", { exact: true }).fill("synthetic-password");
      await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
      await page.waitForURL(base + "/");
      await page.goto(base + "/oferta/" + id);
      await page.waitForURL("**/oferta/" + id);
      checks++;
      await page.getByRole("button", { name: "Quiero este descuento", exact: true }).click();
      await page.waitForURL("https://wa.me/**");
      assert.equal(new URL(contactUrl).pathname, "/51912345678");
      assert.ok(new URL(contactUrl).searchParams.get("text").includes("vengo de JAMA"));
      checks++;
      const saved = offers[0];
      const extra = (suffix, name, priceCents, minutes) => ({
        ...saved,
        id: `00000000-0000-4000-8000-0000000000${suffix}`,
        name,
        originalPriceCents: 2000,
        priceCents,
        endsAt: new Date(Date.now() + minutes * 60000).toISOString(),
      });
      offers = [
        saved,
        extra(42, "Cierra después", 1000, 90),
        extra(43, "Mayor descuento", 500, 100),
        extra(44, "Cierra antes", 1000, 30),
      ];
      await page.goto(base + "/");
      await page
        .getByRole("heading", { name: "La Jama de hoy, al precio de siempre", exact: true })
        .waitFor();
      await page.getByRole("button", { name: "Ver Mayor descuento", exact: true }).waitFor();
      assert.deepEqual(
        await page
          .locator("article")
          .filter({ hasNotText: "Ejemplo · foto ilustrativa" })
          .locator("h3")
          .allTextContents(),
        ["Mayor descuento", "Cierra antes", "Cierra después", "Torta de prueba"],
      );
      assert.ok(
        (
          await page
            .locator("article")
            .filter({ hasNotText: "Ejemplo · foto ilustrativa" })
            .first()
            .textContent()
        ).includes("-75%"),
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        true,
      );
      checks++;
      await page.screenshot({ path: `/tmp/jama-discounts-${width}.png`, fullPage: true });
      await page
        .getByRole("heading", { name: "La Jama de hoy, al precio de siempre", exact: true })
        .evaluate((e) => window.scrollTo(0, scrollY + e.getBoundingClientRect().top - 90));
      await page.screenshot({ path: `/tmp/jama-discounts-detail-${width}.png` });
      if (width < 640) {
        const cards = await page.locator("article").evaluateAll((elements) =>
          elements.slice(0, 2).map((element) => ({
            top: element.getBoundingClientRect().top,
            right: element.getBoundingClientRect().right,
          })),
        );
        assert.equal(cards[0].top, cards[1].top);
        assert.ok(cards.every((card) => card.right <= width));
      }
      checks++;
      await page.getByRole("button", { name: "Ver Torta de prueba", exact: true }).click();
      await page.getByRole("dialog").getByText("-40%", { exact: true }).waitFor();
      await page.getByRole("dialog").getByRole("button", { name: "Más", exact: true }).click();
      offers = offers.map((p) => (p.id === saved.id ? { ...p, priceCents: 400 } : p));
      await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
      await page.getByRole("dialog").getByText("-84%", { exact: true }).waitFor();
      await page.getByRole("dialog").getByText("S/ 4.00", { exact: true }).waitFor();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Agregar al carrito · S/ 8.00", exact: true })
        .waitFor();
      assert.equal(
        (
          await page
            .locator("article")
            .filter({ hasNotText: "Ejemplo · foto ilustrativa" })
            .locator("h3")
            .allTextContents()
        )[0],
        "Torta de prueba",
      );
      checks++;
      offers = [saved];
      await page.goto(base + "/vender");
      await page.getByRole("heading", { name: "Mis ofertas" }).waitFor();
      await page.getByRole("button", { name: "Eliminar", exact: true }).click();
      await page.getByRole("button", { name: "Cancelar", exact: true }).click();
      assert.equal(offers.length, 1);
      checks++;
      await page.getByRole("button", { name: "Eliminar", exact: true }).click();
      await page.getByRole("button", { name: "Confirmar eliminación" }).click();
      await page.getByText("Aún no tienes ofertas. Publica tu primer producto.").waitFor();
      assert.equal(offers.length, 0);
      checks++;
      assert.deepEqual(errors, []);
      checks++;
      await context.close();
    }
    console.log(
      `${checks} Chromium checks passed at 320, 375, 768 and 1280px. Supabase/Auth/Storage and server-function responses mocked; real UI, forms, validation, navigation and click behavior exercised. WhatsApp intercepted; no messages sent.`,
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
