-- Draft catalog imported from the current UI. No live stock is assumed.
-- Review real prices and availability, then explicitly publish via SQL Editor.
insert into public.products (id, name, price_cents, stock, published) values
  ('torta-chocolate', 'Tajada de torta de chocolate', 1500, 0, false),
  ('tres-leches', 'Tres leches con fresas', 900, 0, false),
  ('combo-pan', 'Combo surtido de pan dulce', 800, 0, false),
  ('cupcakes', 'Pack de 3 cupcakes de frutas', 1000, 0, false),
  ('alfajores', 'Caja de alfajores y galletas', 700, 0, false)
on conflict (id) do nothing;
