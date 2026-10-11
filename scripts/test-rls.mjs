import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

// Local PostgreSQL engine with Supabase's role/identity contract simulated.
// This verifies SQL policies; it does not exercise the hosted Supabase Auth API.
const db = new PGlite();
let checks = 0;
const userA = "00000000-0000-4000-8000-000000000001";
const userB = "00000000-0000-4000-8000-000000000002";
try {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  await db.exec(
    await readFile(
      new URL("../supabase/migrations/202610100001_jama_auth_checkout.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(await readFile(new URL("../supabase/seed.sql", import.meta.url), "utf8"));
  await db.query("insert into auth.users (id, raw_user_meta_data) values ($1, $2), ($3, $4)", [
    userA,
    { full_name: "Ana Paredes" },
    userB,
    { full_name: "Luis Paredes" },
  ]);
  assert.equal(
    (await db.query("select count(*)::int as count from public.profiles")).rows[0].count,
    2,
  );
  checks++;
  await db.exec("set role anon");
  assert.equal(
    (await db.query("select id, name, price_cents, stock from public.products")).rows.length,
    0,
  );
  checks++;
  await assert.rejects(db.query("select * from public.profiles"), /permission denied/);
  checks++;
  await assert.rejects(
    db.query("select public.jama_checkout_quote('[]'::jsonb)"),
    /permission denied/,
  );
  checks++;
  await db.exec("reset role");
  await db.query(
    "update public.products set published = true, stock = 2, price_cents = 1700 where id = 'torta-chocolate'",
  );
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userA]);
  const own = (await db.query("select * from public.profiles")).rows;
  assert.equal(own.length, 1);
  assert.equal(own[0].id, userA);
  checks++;
  assert.equal(
    (
      await db.query(
        "update public.profiles set full_name = 'Intruso' where id = $1 returning id",
        [userB],
      )
    ).rows.length,
    0,
  );
  checks++;
  await db.query(
    "update public.profiles set full_name = 'Ana Actualizada', phone = '912345678' where id = $1",
    [userA],
  );
  assert.equal(
    (await db.query("select full_name from public.profiles")).rows[0].full_name,
    "Ana Actualizada",
  );
  checks++;
  await assert.rejects(
    db.query("update public.profiles set id = $1 where id = $2", [userB, userA]),
    /permission denied/,
  );
  checks++;
  await assert.rejects(
    db.query("update public.profiles set created_at = now()"),
    /permission denied/,
  );
  checks++;
  await assert.rejects(
    db.query("insert into public.profiles (id, full_name) values ($1, 'Intruso')", [userB]),
    /permission denied/,
  );
  checks++;
  await assert.rejects(db.query("update public.products set price_cents = 1"), /permission denied/);
  checks++;
  const publicRows = (await db.query("select id, name, price_cents, stock from public.products"))
    .rows;
  assert.deepEqual(
    publicRows.map((row) => row.id),
    ["torta-chocolate"],
  );
  checks++;
  const getQuote = async (items) =>
    (
      await db.query("select public.jama_checkout_quote($1::jsonb) as quote", [
        JSON.stringify(items),
      ])
    ).rows[0].quote;
  const quote = await getQuote([{ productId: "torta-chocolate", qty: 2 }]);
  assert.equal(quote.totalCents, 3400);
  assert.equal(quote.items[0].unitPriceCents, 1700);
  checks++;
  for (const invalid of [
    [{ productId: "torta-chocolate", qty: 3 }],
    [{ productId: "tres-leches", qty: 1 }],
    [{ productId: "torta-chocolate", qty: 1, price_cents: 1 }],
    [
      { productId: "torta-chocolate", qty: 2 },
      { productId: "torta-chocolate", qty: 2 },
    ],
    [{ productId: "torta-chocolate", qty: 0 }],
    [{ productId: "torta-chocolate", qty: 1.5 }],
    [],
  ]) {
    await assert.rejects(getQuote(invalid), /Invalid cart|Product unavailable/);
    checks++;
  }
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
  await assert.rejects(
    getQuote([{ productId: "torta-chocolate", qty: 1 }]),
    /Authentication required/,
  );
  checks++;
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userB]);
  assert.equal((await db.query("select * from public.profiles")).rows[0].full_name, "Luis Paredes");
  checks++;
  await db.exec(`reset role;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text unique, metadata jsonb);
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated;
    grant select, insert, update, delete on storage.objects to authenticated;
  `);
  await db.exec(
    await readFile(
      new URL("../supabase/migrations/202610100002_jama_business_offers.sql", import.meta.url),
      "utf8",
    ),
  );
  // Emulate an unrelated application's broad Storage policies. Restrictive
  // JAMA guards must still prevent writes/deletes in another seller's folder.
  await db.exec(`
    create policy unrelated_images_insert on storage.objects for insert to authenticated with check (true);
    create policy unrelated_images_update on storage.objects for update to authenticated using (true) with check (true);
    create policy unrelated_images_delete on storage.objects for delete to authenticated using (true);
  `);
  const businessA = "00000000-0000-4000-8000-000000000011";
  const businessB = "00000000-0000-4000-8000-000000000012";
  const offerA = "00000000-0000-4000-8000-000000000021";
  const offerB = "00000000-0000-4000-8000-000000000022";
  const filename = "00000000-0000-4000-8000-000000000031.jpg";
  const pathA = `${userA}/${offerA}/${filename}`;
  const pathB = `${userB}/${offerB}/${filename}`;
  const asUser = async (id) => {
    await db.exec("reset role; set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  };
  await asUser(userA);
  for (const number of ["", "012345678", "519123", "javascript:alert(1)"]) {
    await assert.rejects(
      db.query(
        "insert into public.businesses (owner_id, name, zone, whatsapp) values ($1, 'Negocio A', 'Centro', $2)",
        [userA, number],
      ),
      /check constraint/,
    );
    checks++;
  }
  await db.query(
    "insert into public.businesses (id, owner_id, name, zone, whatsapp) values ($1, $2, 'Negocio A', 'Centro', '51912345678')",
    [businessA, userA],
  );
  await assert.rejects(
    db.query(
      "insert into public.businesses (owner_id, name, zone, whatsapp) values ($1, 'Intruso', 'Centro', '51912345678')",
      [userB],
    ),
    /row-level security/,
  );
  checks++;
  await assert.rejects(
    db.query("update public.businesses set owner_id = $1 where id = $2", [userB, businessA]),
    /permission denied/,
  );
  checks++;
  await db.query(
    "insert into storage.objects (bucket_id, name, metadata) values ('offer-images', $1, $2)",
    [pathA, { mimetype: "image/jpeg", size: 1000 }],
  );
  await assert.rejects(
    db.query(
      "insert into storage.objects (bucket_id, name, metadata) values ('offer-images', $1, $2)",
      [pathB, { mimetype: "image/jpeg", size: 1000 }],
    ),
    /row-level security/,
  );
  checks++;
  const insertOffer = async (
    id,
    business,
    image,
    price = 1500,
    original = 2500,
    end = "now() + interval '2 hours'",
  ) =>
    db.query(
      `
    insert into public.products (id, business_id, name, description, category, price_cents, original_price_cents, stock, image_path, starts_at, ends_at, published)
    values ($1, $2, 'Torta real', 'Porción de chocolate', 'tortas', $3, $4, 5, $5, now() - interval '1 hour', ${end}, true)`,
      [id, business, price, original, image],
    );
  const invalidId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const invalidPath = `${userA}/${invalidId}/${filename}`;
  await db.query(
    "insert into storage.objects (bucket_id, name, metadata) values ('offer-images', $1, $2)",
    [invalidPath, { mimetype: "image/jpeg", size: 1000 }],
  );
  await assert.rejects(insertOffer(invalidId, businessA, invalidPath), /jama_offer_identity/);
  checks++;
  await assert.rejects(
    insertOffer(offerA, businessA, `${userA}/${offerA}/00000000-0000-4000-8000-000000000099.jpg`),
    /Valid product image/,
  );
  checks++;
  await insertOffer(offerA, businessA, pathA);
  assert.equal(
    (await db.query("delete from storage.objects where name = $1 returning name", [pathA])).rows
      .length,
    0,
  );
  checks++;
  await asUser(userB);
  assert.equal((await db.query("select * from public.businesses")).rows.length, 0);
  checks++;
  assert.equal(
    (
      await db.query("update public.products set price_cents = 1 where id = $1 returning id", [
        offerA,
      ])
    ).rows.length,
    0,
  );
  checks++;
  assert.equal(
    (await db.query("delete from public.products where id = $1 returning id", [offerA])).rows
      .length,
    0,
  );
  checks++;
  assert.equal(
    (await db.query("delete from storage.objects where name = $1 returning name", [pathA])).rows
      .length,
    0,
  );
  checks++;
  await db.query(
    "insert into public.businesses (id, owner_id, name, zone, whatsapp) values ($1, $2, 'Negocio B', 'Norte', '51987654321')",
    [businessB, userB],
  );
  await db.query(
    "insert into storage.objects (bucket_id, name, metadata) values ('offer-images', $1, $2)",
    [pathB, { mimetype: "image/jpeg", size: 1000 }],
  );
  await assert.rejects(insertOffer(offerB, businessA, pathB), /Owner required|row-level security/);
  checks++;
  await assert.rejects(insertOffer(offerB, businessB, pathA), /Invalid image owner/);
  checks++;
  await assert.rejects(insertOffer(offerB, businessB, pathB, 2500, 2000), /check constraint/);
  checks++;
  await assert.rejects(
    insertOffer(offerB, businessB, pathB, 1500, 2500, "now() - interval '30 minutes'"),
    /Valid future offer/,
  );
  checks++;
  await db
    .query("update storage.objects set metadata = $1 where name = $2 returning name", [
      { mimetype: "image/jpeg", size: 9999999 },
      pathB,
    ])
    .then((r) => assert.equal(r.rows.length, 0));
  checks++;
  await db.exec("reset role");
  for (const metadata of [
    { mimetype: "image/svg+xml", size: 1000 },
    { mimetype: "image/jpeg", size: 5242881 },
    { mimetype: "image/png" },
  ]) {
    await db.query("update storage.objects set metadata = $1 where name = $2", [metadata, pathB]);
    await asUser(userB);
    await assert.rejects(insertOffer(offerB, businessB, pathB), /Valid product image/);
    checks++;
    await db.exec("reset role");
  }
  await db.query("update storage.objects set metadata = $1 where name = $2", [
    { mimetype: "image/jpeg", size: 1000 },
    pathB,
  ]);
  await asUser(userB);
  await insertOffer(offerB, businessB, pathB);
  await db.exec("reset role; set role anon");
  const catalog = async () =>
    (await db.query("select public.jama_public_catalog() as catalog")).rows[0].catalog;
  let publicCatalog = await catalog();
  assert.equal(publicCatalog.items.length, 2);
  checks++;
  assert.equal(publicCatalog.items[0].priceCents, 1500);
  checks++;
  assert.equal(Object.hasOwn(publicCatalog.items[0], "whatsapp"), false);
  checks++;
  assert.equal(Object.hasOwn(publicCatalog.items[0], "owner_id"), false);
  checks++;
  assert.equal((await db.query("select id from public.products")).rows.length, 2);
  checks++;
  await assert.rejects(db.query("select * from public.businesses"), /permission denied/);
  checks++;
  await assert.rejects(
    db.query("select public.jama_contact_offer($1)", [offerA]),
    /permission denied/,
  );
  checks++;
  await asUser(userA);
  const contact = async (id) =>
    (await db.query("select public.jama_contact_offer($1) as offer", [id])).rows[0].offer;
  assert.equal((await contact(offerB)).whatsapp, "51987654321");
  checks++;
  assert.equal(
    (await db.query("select stock from public.products where id = $1", [offerB])).rows[0].stock,
    5,
  );
  checks++;
  const sellerQuote = await getQuote([{ productId: offerA, qty: 2 }]);
  assert.equal(sellerQuote.totalCents, 3000);
  checks++;
  await db.query("update public.products set published = false where id = $1", [offerA]);
  await assert.rejects(contact(offerA), /Offer unavailable/);
  checks++;
  await assert.rejects(getQuote([{ productId: offerA, qty: 1 }]), /Product unavailable/);
  checks++;
  await db.query(
    "update public.products set published = true, starts_at = now() + interval '1 hour' where id = $1",
    [offerA],
  );
  await assert.rejects(contact(offerA), /Offer unavailable/);
  checks++;
  await db.query("update public.products set starts_at = now() - interval '1 hour' where id = $1", [
    offerA,
  ]);
  await db.query("update public.products set stock = 0 where id = $1", [offerA]);
  await assert.rejects(contact(offerA), /Offer unavailable/);
  checks++;
  await db.exec("reset role");
  // A discount expires naturally: emulate elapsed database time as admin.
  await db.query(
    "update public.products set published = false, stock = 5, ends_at = now() - interval '30 minutes' where id = $1",
    [offerA],
  );
  await asUser(userA);
  await assert.rejects(
    db.query("update public.products set published = true where id = $1", [offerA]),
    /Valid future offer/,
  );
  checks++;
  await assert.rejects(contact(offerA), /Offer unavailable/);
  checks++;
  assert.equal(
    (await db.query("select id from public.products where business_id = $1", [businessA])).rows
      .length,
    1,
  );
  checks++;
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
  await assert.rejects(contact(offerB), /Authentication required/);
  checks++;
  await asUser(userA);
  await db.query("delete from public.products where id = $1", [offerA]);
  assert.equal(
    (await db.query("delete from storage.objects where name = $1 returning name", [pathA])).rows
      .length,
    1,
  );
  checks++;
  await db.exec("reset role; set role anon");
  publicCatalog = await catalog();
  assert.equal(publicCatalog.items.length, 1);
  checks++;
  // Upgrade existing data through the new migration; do not recreate the schema.
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
  await db.exec(
    await readFile(
      new URL("../supabase/migrations/202610100003_jama_categories_approval.sql", import.meta.url),
      "utf8",
    ),
  );
  assert.equal((await db.query("select count(*)::int as n from public.businesses")).rows[0].n, 2);
  assert.equal(
    (await db.query("select count(*)::int as n from public.products where business_id is not null"))
      .rows[0].n,
    1,
  );
  checks += 2;
  await db.exec("set role anon");
  assert.equal((await catalog()).items.length, 0);
  assert.equal((await db.query("select id from public.products")).rows.length, 0);
  checks += 2;
  await assert.rejects(db.query("select * from public.jama_admins"), /permission denied/);
  checks++;
  await assert.rejects(
    db.query("select public.jama_review_business($1, 'approved', '')", [businessB]),
    /permission denied/,
  );
  checks++;
  const initialCategories = (await db.query("select id from public.jama_categories")).rows.map(
    (c) => c.id,
  );
  assert.ok(
    initialCategories.includes("cafeteria") &&
      initialCategories.includes("restaurantes") &&
      initialCategories.includes("alimentos"),
  );
  checks++;
  await asUser(userB);
  assert.equal((await db.query("select public.jama_is_admin() as admin")).rows[0].admin, false);
  checks++;
  assert.equal(
    (await db.query("select status from public.businesses where id = $1", [businessB])).rows[0]
      .status,
    "pending",
  );
  checks++;
  assert.equal(
    (await db.query("select id from public.products where id = $1", [offerB])).rows.length,
    1,
  );
  checks++;
  await assert.rejects(contact(offerB), /Offer unavailable/);
  checks++;
  await assert.rejects(getQuote([{ productId: offerB, qty: 1 }]), /Product unavailable/);
  checks++;
  await assert.rejects(
    db.query("update public.products set published = true where id = $1", [offerB]),
    /Approved business required/,
  );
  checks++;
  await assert.rejects(
    db.query("update public.businesses set status = 'approved' where id = $1", [businessB]),
    /permission denied/,
  );
  checks++;
  await assert.rejects(
    db.query(
      "insert into public.businesses (owner_id, name, zone, whatsapp, status) values ($1, 'Intruso', 'Centro', '51912345678', 'approved')",
      [userB],
    ),
    /permission denied/,
  );
  checks++;
  await assert.rejects(
    db.query("insert into public.jama_admins (user_id) values ($1)", [userB]),
    /permission denied/,
  );
  checks++;
  await assert.rejects(
    db.query("select public.jama_review_business($1, 'approved', '')", [businessB]),
    /Administrator required/,
  );
  checks++;
  await assert.rejects(
    db.query("insert into public.jama_categories (id, label) values ('intrusa', 'Intrusa')"),
    /row-level security/,
  );
  checks++;
  await assert.rejects(
    db.query("update public.businesses set category = 'tortas' where id = $1", [businessB]),
    /Valid business category/,
  );
  checks++;
  await assert.rejects(
    db.query("update public.businesses set category = 'inexistente' where id = $1", [businessB]),
    /Valid business category/,
  );
  checks++;
  await db.query("update public.products set published = false where id = $1", [offerB]);
  assert.equal(
    (await db.query("select published from public.products where id = $1", [offerB])).rows[0]
      .published,
    false,
  );
  checks++;
  // Simulate the documented SQL Editor bootstrap; users cannot run this operation.
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
  await db.query("insert into public.jama_admins (user_id) values ($1)", [userA]);
  await asUser(userA);
  assert.equal((await db.query("select public.jama_is_admin() as admin")).rows[0].admin, true);
  checks++;
  assert.equal((await db.query("select id from public.businesses")).rows.length, 2);
  checks++;
  await assert.rejects(
    db.query("select public.jama_review_business($1, 'invented', '')", [businessB]),
    /Invalid review/,
  );
  checks++;
  await db.query("select public.jama_review_business($1, 'rejected', 'Falta información')", [
    businessB,
  ]);
  assert.equal(
    (await db.query("select status from public.businesses where id = $1", [businessB])).rows[0]
      .status,
    "rejected",
  );
  checks++;
  await db.query("select public.jama_review_business($1, 'approved', '')", [businessB]);
  assert.equal(
    (await db.query("select reviewed_by from public.businesses where id = $1", [businessB])).rows[0]
      .reviewed_by,
    userA,
  );
  checks++;
  assert.equal(
    (
      await db.query("update public.products set price_cents = 1 where id = $1 returning id", [
        offerB,
      ])
    ).rows.length,
    0,
  );
  checks++;
  await db.query(
    "insert into public.jama_categories (id, label, name_label, description_hint) values ('mercado_local', 'Mercado local', 'Nombre de la canasta', 'Indica peso y conservación.')",
  );
  await asUser(userB);
  await db.query("update public.businesses set category = 'mercado_local' where id = $1", [
    businessB,
  ]);
  assert.equal(
    (await db.query("select status from public.businesses where id = $1", [businessB])).rows[0]
      .status,
    "pending",
  );
  checks++;
  await asUser(userA);
  await db.query("select public.jama_review_business($1, 'approved', '')", [businessB]);
  await asUser(userB);
  await db.query(
    "update public.products set category = 'mercado_local', published = true, price_cents = 1200, original_price_cents = 2000 where id = $1",
    [offerB],
  );
  assert.equal((await contact(offerB)).priceCents, 1200);
  checks++;
  assert.equal((await getQuote([{ productId: offerB, qty: 1 }])).totalCents, 1200);
  checks++;
  await assert.rejects(
    db.query("update public.products set price_cents = original_price_cents where id = $1", [
      offerB,
    ]),
    /check constraint/,
  );
  checks++;
  await assert.rejects(
    db.query("update public.products set stock = -1 where id = $1", [offerB]),
    /check constraint/,
  );
  checks++;
  await assert.rejects(
    db.query("update public.products set category = 'inexistente' where id = $1", [offerB]),
    /Valid offer category/,
  );
  checks++;
  const extraIds = [];
  for (const [suffix, price, original, minutes] of [
    [41, 1000, 2000, 90],
    [42, 1500, 3000, 30],
    [43, 20002, 30000, 20],
    [44, 20001, 30000, 100],
  ]) {
    const id = `00000000-0000-4000-8000-0000000000${suffix}`;
    const path = `${userB}/${id}/${filename}`;
    await db.query(
      "insert into storage.objects (bucket_id, name, metadata) values ('offer-images', $1, $2)",
      [path, { mimetype: "image/jpeg", size: 1000 }],
    );
    await insertOffer(
      id,
      businessB,
      path,
      price,
      original,
      `now() + interval '${minutes} minutes'`,
    );
    extraIds.push(id);
  }
  await db.exec("reset role; set role anon");
  assert.deepEqual(
    (await catalog()).items.map((p) => p.id),
    [extraIds[1], extraIds[0], offerB, extraIds[3], extraIds[2]],
  );
  checks++;
  assert.ok(
    !(await catalog()).items.some(
      (p) => Object.hasOwn(p, "whatsapp") || Object.hasOwn(p, "review_note"),
    ),
  );
  checks++;
  assert.ok(
    (await db.query("select name_label from public.jama_categories where id = 'mercado_local'"))
      .rows[0].name_label === "Nombre de la canasta",
  );
  checks++;
  await asUser(userB);
  await db.query("update public.products set price_cents = 800 where id = $1", [offerB]);
  assert.equal((await catalog()).items[0].id, offerB);
  checks++;
  // Availability after price changes, stock depletion, pausing and scheduled dates.
  for (const change of [
    "published = false",
    "stock = 0",
    "starts_at = now() + interval '1 hour'",
    "published = false, ends_at = now() - interval '1 minute'",
  ]) {
    await db.query(`update public.products set ${change} where id = $1`, [offerB]);
    assert.ok(!(await catalog()).items.some((p) => p.id === offerB));
    checks++;
    await assert.rejects(contact(offerB), /Offer unavailable/);
    checks++;
    await assert.rejects(getQuote([{ productId: offerB, qty: 1 }]), /Product unavailable/);
    checks++;
    await db.query(
      "update public.products set stock = 5, published = true, starts_at = now() - interval '1 hour', ends_at = now() + interval '2 hours' where id = $1",
      [offerB],
    );
  }
  await db.query("update public.businesses set whatsapp = '51912345678' where id = $1", [
    businessB,
  ]);
  assert.equal(
    (await db.query("select status from public.businesses where id = $1", [businessB])).rows[0]
      .status,
    "pending",
  );
  checks++;
  assert.equal((await catalog()).items.length, 0);
  checks++;
  await asUser(userA);
  await db.query("select public.jama_review_business($1, 'approved', '')", [businessB]);
  await db.query("update public.jama_categories set active = false where id = 'mercado_local'");
  assert.equal((await catalog()).items.length, 0);
  checks++;
  await asUser(userB);
  await assert.rejects(contact(offerB), /Offer unavailable/);
  checks++;
  await asUser(userA);
  // A disabled category must not prevent an admin from withdrawing approval.
  await db.query("select public.jama_review_business($1, 'rejected', 'Categoría en revisión')", [
    businessB,
  ]);
  assert.equal((await catalog()).items.length, 0);
  checks++;
  await db.query("update public.jama_categories set active = true where id = 'mercado_local'");
  assert.equal((await catalog()).items.length, 0);
  checks++;
  await db.query("select public.jama_review_business($1, 'approved', '')", [businessB]);
  await db.query("select public.jama_review_business($1, 'pending', '')", [businessB]);
  assert.equal((await catalog()).items.length, 0);
  checks++;
  await db.exec("reset role; set role anon");
  assert.equal((await db.query("select id from public.products")).rows.length, 0);
  checks++;
  await db.exec("reset role");
  const rlsTables = (
    await db.query(`select c.relname as name, c.relrowsecurity as enabled
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in ('profiles', 'businesses', 'products', 'jama_categories', 'jama_admins')`)
  ).rows;
  assert.equal(rlsTables.length, 5);
  checks++;
  assert.ok(rlsTables.every((table) => table.enabled));
  checks++;
  assert.equal(
    (
      await db.query(
        "select relrowsecurity as enabled from pg_class where oid = 'storage.objects'::regclass",
      )
    ).rows[0].enabled,
    true,
  );
  checks++;
  for (const [role, table, privilege] of [
    ["anon", "profiles", "SELECT"],
    ["anon", "businesses", "SELECT"],
    ["authenticated", "jama_admins", "SELECT"],
    ["authenticated", "jama_admins", "INSERT"],
    ["authenticated", "jama_admins", "UPDATE"],
  ]) {
    assert.equal(
      (
        await db.query("select has_table_privilege($1, $2, $3) as allowed", [
          role,
          `public.${table}`,
          privilege,
        ])
      ).rows[0].allowed,
      false,
    );
    checks++;
  }
  const definers = (
    await db.query(`select p.proname, p.proconfig from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'jama_%' and p.prosecdef`)
  ).rows;
  assert.ok(
    definers.length > 0 && definers.every((fn) => fn.proconfig?.includes('search_path=""')),
  );
  checks++;
  for (const name of [
    "jama_contact_offer(text)",
    "jama_review_business(uuid,text,text)",
    "jama_validate_offer()",
  ]) {
    assert.equal(
      (
        await db.query("select has_function_privilege('anon', $1, 'EXECUTE') as allowed", [
          `public.${name}`,
        ])
      ).rows[0].allowed,
      false,
    );
    checks++;
  }
  // Upgrade the previous approval model without deleting or publishing drafts.
  await asUser(userA);
  await db.query("select public.jama_review_business($1, 'rejected', 'Bloqueado')", [businessA]);
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
  await db.query(
    "update public.products set published = false where business_id = $1 and id <> $2",
    [businessB, offerB],
  );
  const beforeDirect = (await db.query("select id, published from public.products order by id"))
    .rows;
  await db.exec(
    await readFile(
      new URL("../supabase/migrations/202610110004_jama_direct_publication.sql", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(
    (await db.query("select id, published from public.products order by id")).rows,
    beforeDirect,
  );
  checks++;
  assert.equal(
    (await db.query("select status from public.businesses where id = $1", [businessB])).rows[0]
      .status,
    "approved",
  );
  assert.equal(
    (await db.query("select status from public.businesses where id = $1", [businessA])).rows[0]
      .status,
    "rejected",
  );
  checks += 2;
  await db.exec("set role anon");
  assert.ok((await catalog()).items.some((p) => p.id === offerB));
  checks++;
  await asUser(userB);
  await db.query(
    "update public.businesses set name = 'Negocio editado', whatsapp = '51987654321' where id = $1",
    [businessB],
  );
  assert.equal(
    (await db.query("select status from public.businesses where id = $1", [businessB])).rows[0]
      .status,
    "approved",
  );
  assert.equal((await contact(offerB)).whatsapp, "51987654321");
  checks += 2;
  await db.query("update public.products set published = false where id = $1", [offerB]);
  assert.equal((await catalog()).items.length, 0);
  await db.query("update public.products set published = true where id = $1", [offerB]);
  assert.ok((await catalog()).items.some((p) => p.id === offerB));
  checks += 2;
  await asUser(userA);
  await db.query("update public.businesses set name = 'Negocio bloqueado editado' where id = $1", [
    businessA,
  ]);
  assert.equal(
    (await db.query("select status from public.businesses where id = $1", [businessA])).rows[0]
      .status,
    "rejected",
  );
  checks++;
  const userC = "00000000-0000-4000-8000-000000000003";
  await db.exec("reset role");
  await db.query("insert into auth.users (id) values ($1)", [userC]);
  await asUser(userC);
  const directBusiness = (
    await db.query(
      "insert into public.businesses (owner_id, name, zone, whatsapp, category) values ($1, 'Negocio directo', 'Centro', '51912345678', 'cafeteria') returning id, status",
      [userC],
    )
  ).rows[0];
  assert.equal(directBusiness.status, "approved");
  checks++;
  const directOffer = "00000000-0000-4000-8000-000000000033";
  const directPath = `${userC}/${directOffer}/00000000-0000-4000-8000-000000000099.jpg`;
  await db.query(
    "insert into storage.objects (bucket_id, name, metadata) values ('offer-images', $1, $2)",
    [directPath, { mimetype: "image/jpeg", size: 1000 }],
  );
  await insertOffer(directOffer, directBusiness.id, directPath);
  await db.exec("reset role; set role anon");
  assert.ok((await catalog()).items.some((p) => p.id === directOffer));
  checks++;
  await asUser(userC);
  await assert.rejects(
    db.query("update public.businesses set status = 'approved' where id = $1", [directBusiness.id]),
    /permission denied/,
  );
  await assert.rejects(
    db.query("select public.jama_review_business($1, 'approved', '')", [businessA]),
    /Administrator required/,
  );
  assert.equal(
    (await db.query("select id from public.products where id = $1", [offerB])).rows.length,
    1,
  );
  assert.equal(
    (await db.query("update public.products set stock = 10 where id = $1 returning id", [offerB]))
      .rows.length,
    0,
  );
  checks += 4;
  console.log(
    `${checks} PostgreSQL checks passed: profiles, seller isolation, image policies, safe migration, direct publication, preserved drafts, administrator-only suspension, extensible categories, exact discount order, active public catalog, WhatsApp authorization, expiry, server prices and stock. Storage HTTP/bytes and hosted Auth are not simulated by PostgreSQL.`,
  );
} catch (error) {
  console.error(`${error.name}: ${error.message}${error.query ? `\nQuery: ${error.query}` : ""}`);
  process.exitCode = 1;
} finally {
  await db.close();
}
