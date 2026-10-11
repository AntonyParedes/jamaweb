# JAMA: cuentas, negocios y ofertas

Repositorio: `AntonyParedes/jamaweb`. Proyecto Supabase actual:
`qzsmhpjjejnrwolackgz`. Sitio: `https://jamaweb.vercel.app`.

## Aplicar el esquema

1. Inspeccionar las tablas y políticas existentes antes de ejecutar SQL. La primera
   migración ya se ejecutó durante la configuración de Auth. **No repetirla** si
   existen `profiles`, `products` y `jama_checkout_quote`.
2. Si el proyecto está vacío, ejecutar primero
   `supabase/migrations/202610100001_jama_auth_checkout.sql`.
3. En proyectos nuevos, ejecutar una sola vez en **SQL Editor → New query → Run**:
   `supabase/migrations/202610100002_jama_business_offers.sql`.
   La transacción amplía `products`, crea `businesses`, el bucket `offer-images`,
   políticas RLS y las funciones de catálogo/contacto. No crea otra tabla de
   productos ni modifica perfiles. Si hay políticas ajenas de productos, aborta
   para que se revisen antes de conceder permisos. Ante un error, la transacción
   revierte todos sus cambios; revisar el error antes de volver a ejecutar.
4. Las tres migraciones ya están aplicadas al proyecto actual. En proyectos
   nuevos, ejecutar `supabase/migrations/202610100003_jama_categories_approval.sql`
   una vez después de las anteriores. Reutiliza `businesses` y `products`, añade la
   taxonomía `jama_categories` y el registro privado `jama_admins`, y refuerza las
   funciones y políticas existentes. No elimina negocios, productos ni imágenes.
   Todos los negocios existentes pasan a `pending`: no hubo un proceso previo de
   aprobación que permita marcarlos como revisados. Las ofertas se conservan,
   pero quedan ocultas hasta la aprobación del negocio.
5. Verificar en Table Editor las nuevas columnas de `products` y `businesses`;
   en Storage, el bucket `offer-images`, público, límite 5 MB, MIME JPEG/PNG/WebP.
6. Los cinco registros de `supabase/seed.sql` son ejemplos antiguos sin propietario
   ni foto subida al bucket. Se conservan pero **no se muestran como ofertas
   vendibles**. El seed es opcional en proyectos nuevos. Publicar productos reales
   desde `/vender`, después de registrar y aprobar el negocio; no asignar precios ni stock
   ficticios a productos de ejemplo.

La clave publishable no permite ejecutar migraciones. Usar SQL Editor con la cuenta
administradora o un despliegue de migraciones administrativo seguro. No entregar
`service_role`, claves secretas ni contraseñas de PostgreSQL al navegador/chat.

## Administradores y categorías extensibles

1. Elegir una cuenta real en **Authentication → Users** y copiar su UID. La
   administración no se obtiene por correo, metadatos de usuario ni por registrarse.
2. Como propietario del proyecto, ejecutar en SQL Editor, sustituyendo el UID:

   ```sql
   insert into public.jama_admins (user_id)
   values ('REEMPLAZAR_POR_UID_REAL'::uuid)
   on conflict (user_id) do nothing;
   ```

   Solo el acceso administrativo a la base puede asignar o retirar estos roles;
   no se concede lectura/escritura de `jama_admins` a clientes ni usuarios normales.

3. Iniciar sesión con esa cuenta, abrir **Mi cuenta → Revisar negocios** o
   `/administracion`. Revisar categoría, zona y WhatsApp; aprobar, no aprobar con
   una observación, o devolver a revisión. `jama_review_business()` verifica el rol
   nuevamente en PostgreSQL y registra la fecha y el revisor. La aprobación del
   negocio no publica automáticamente los borradores: el dueño debe reactivarlos.
4. Para una categoría nueva, agregar una fila en `jama_categories`, sin modificar
   TypeScript ni reconstruir la aplicación. Por ejemplo, como administrador:

   ```sql
   insert into public.jama_categories
     (id, label, emoji, business_enabled, offer_enabled, name_label, description_hint, position)
   values
     ('mercado_local', 'Mercado local', '🥬', true, true, 'Nombre de la canasta',
      'Indica peso, contenido y conservación.', 70);
   ```

   `business_enabled` controla el registro de negocios; `offer_enabled`, los tipos
   de ofertas; `active=false` retira una categoría de los formularios y del catálogo.
   Los cambios se consultan cada 30 segundos y al recuperar foco. Los identificadores
   deben ser slugs de 2 a 50 caracteres; las claves foráneas impiden borrar una
   categoría usada. Los administradores también pueden insertar/actualizar categorías
   mediante la API autenticada, protegida por RLS; no hay otro panel innecesario.

Los campos base de ofertas siguen siendo universales: foto, nombre, descripción,
precios, cantidad y vigencia. Cada categoría configura el rótulo del nombre y la
ayuda de descripción (porciones, combos, peso, conservación o alérgenos), sin pedir
campos sin utilidad para ese tipo de oferta. La revisión administrativa decide la
compatibilidad del negocio con las ofertas de cierre.

## Autenticación y variables

- **Authentication → Sign In / Providers**: Email provider activo.
- **User Signups → Confirm email**: **desactivado**, según la decisión del usuario.
  Esto permite crear una cuenta y obtener sesión sin correo de confirmación.
  No elimina los límites de recuperación ni corrige contraseñas ya existentes.
- **URL Configuration → Site URL**: `https://jamaweb.vercel.app`.
- Redirect URLs: `https://jamaweb.vercel.app/acceso**`; agregar únicamente los
  dominios de preview usados y `http://localhost:3000/acceso**` para desarrollo.
- Recuperación de contraseña sigue enviando correo. Para clientes reales configurar
  un proveedor SMTP; `over_email_send_rate_limit` significa que el proveedor
  integrado alcanzó su límite, no un fallo del registro ni de Vercel.

Copiar `.env.example` a `.env.local` para desarrollo. Usar estas mismas variables
públicas en Vercel, Production/Preview/Development:

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_<clave-publica>
```

Vite las incorpora al build: cambiar valores requiere reconstruir. `.env.local`
está ignorado. Nunca usar `sb_secret_*` ni `service_role` en `VITE_*`.
Permitir el host del proyecto Supabase en la red del entorno de desarrollo.

## Cómo funciona

- Inicio, explorar, categorías, búsqueda, favoritos, detalle y carrito son públicos.
  Todas las tarjetas usan un único catálogo vivo obtenido por
  `jama_public_catalog()`, sin sustitución por productos locales de ejemplo.
  El cliente refresca cada 30 segundos y al recuperar foco. La vigencia en pantalla
  se calcula con la hora de PostgreSQL más el tiempo transcurrido, no con el reloj
  del dispositivo. La autorización final siempre consulta otra vez PostgreSQL.
- La sección del inicio se llama **La Jama de hoy, al precio de siempre**. SQL ordena
  por `((original_price_cents - price_cents) / original_price_cents) * 100` sin
  redondear antes de comparar. Desempata por `ends_at` ascendente y después por ID.
  El cliente compara céntimos exactamente con `BigInt`, recalcula al recibir precios
  nuevos y mantiene el detalle abierto sincronizado con el catálogo. El porcentaje
  mostrado tiene hasta dos decimales, truncados para no exagerar el descuento.
- `/vender` requiere sesión verificada. El negocio incluye nombre, zona y WhatsApp
  comercial obligatorio. Perú usa +51 como valor inicial; se permiten otros códigos.
  La validación comprueba formato, no que el número realmente tenga WhatsApp activo.
- El registro exige categoría y crea una solicitud `pending`. Los dueños pueden
  guardar borradores; solo un negocio `approved` puede publicar o reactivar.
  Modificar nombre, zona, WhatsApp o categoría vuelve a `pending`, limpia la revisión
  previa y oculta las ofertas. Se puede consultar su estado con **Actualizar estado**.
- Un negocio por usuario. Formularios de oferta: nombre, descripción, categoría,
  foto, precio normal/descontado, cantidad e inicio/fin (horario America/Lima).
  Los precios se guardan en céntimos y las fechas en `timestamptz`.
- Se pueden crear, editar, pausar, reactivar y eliminar ofertas. Eliminar exige una
  confirmación visible. Ofertas futuras quedan programadas; pausadas, vencidas,
  agotadas, de categorías inactivas o de negocios no aprobados no aparecen en el
  catálogo ni permiten contacto o checkout. Los dueños pueden ver las suyas.
- “Quiero este descuento” abre `/oferta/<uuid>`. Si falta sesión, se solicita acceso.
  Por decisión del usuario, iniciar sesión o registrarse con sesión activa lleva
  siempre al inicio de JAMA, incluso al llegar desde una oferta, negocio o carrito.
  La recuperación de contraseña conserva su formulario hasta completarse.
- Al pulsar el botón del detalle, el servidor valida `auth.getUser()` y llama
  `jama_contact_offer()`, que verifica publicación, vigencia y stock con hora de
  PostgreSQL. El enlace de WhatsApp usa exclusivamente el teléfono, nombre y
  precio obtenidos de la base. JAMA prepara un mensaje; no lo envía automáticamente.
- No se cobran pagos, crean pedidos ni reservan/descuentan existencias al abrir
  WhatsApp. La operación se acuerda con el negocio. El vendedor actualiza su stock.
- El carrito y favoritos siguen guardados localmente. El checkout protegido usa
  precios/stock del servidor y una cotización que vence en cinco minutos o al
  finalizar el primer descuento, lo que suceda antes. No habilita pagos.

## RLS y fotografías

`profiles` mantiene acceso privado por usuario. `businesses` solo permite leer y
modificar el negocio propio. Los campos del propietario no se aceptan del formulario:
el servidor deriva el usuario de su token verificado y busca su negocio.

`products` permite lectura pública de ofertas activas y lectura/gestión de ofertas
propias mediante RLS. No permite cambiar ID o negocio de una oferta. Constraints y
trigger validan precios, fechas, foto asociada al producto y pertenencia al vendedor.
El catálogo público es una proyección explícita de campos de la oferta y nombre/zona
del negocio; no devuelve perfiles, correo, propietario ni WhatsApp. La RPC de
contacto exige identidad y devuelve solo la información necesaria de una oferta activa.
Las funciones definer tienen `search_path` vacío y permisos explícitos.

Las fotos se suben directamente a Storage para admitir 5 MB sin superar el límite
inferior del cuerpo de petición de Vercel. Ruta:
`<usuario>/<producto>/<archivo-aleatorio>.jpg|png|webp`. El formulario valida
MIME/tamaño y muestra una vista previa. Antes de guardar, el servidor descarga la
foto propia y verifica tamaño y firma de archivo; el bucket valida tamaño/MIME,
y el trigger comprueba metadata y asociación. La validación de firma identifica
el formato, no sustituye un análisis antivirus ni una decodificación completa.

Las políticas impiden sobrescribir archivos y borrar fotografías todavía referidas
por un producto. Los reemplazos usan nuevos nombres y eliminan la foto anterior tras
guardar; los fallos intentan limpiar fotos huérfanas. Los permisos restrictivos del
bucket siguen protegiéndolo aunque existan políticas permisivas de otros buckets.
Fotos públicas siguen siendo accesibles por su URL aunque la oferta se pause o venza.
Eliminar una oferta intenta retirar también su archivo. Si la limpieza falla tras
un guardado/eliminación exitoso, puede quedar un archivo huérfano: revisar Storage.

## Validación

```sh
bun install --frozen-lockfile
npm test
npm run test:db
node_modules/.bin/tsc --noEmit
VERCEL=1 npm run build
npm run dev -- --host 0.0.0.0 --port 3000 --strictPort
```

Las pruebas de aplicación usan servicios simulados. `test:db` aplica las tres
migraciones reales en PGlite con roles, `auth.uid()` y tablas Storage simulados;
comprueba RLS, aislamiento de vendedores, metadata/tamaño, vigencia, contacto y
cotizaciones. No ejecuta el servicio HTTP de Storage ni Auth alojado.

El recorrido de navegador está en `scripts/test-offers-browser.cjs`. Requiere
Playwright, Chromium y el servidor Vite local. Si Playwright está instalado fuera
del proyecto, pasar su módulo mediante `JAMA_PLAYWRIGHT_MODULE`. En este entorno:

```sh
JAMA_PLAYWRIGHT_MODULE=/opt/codex/cua_node/lib/node_modules/playwright node scripts/test-offers-browser.cjs
```

Intercepta Auth, Storage, funciones del servidor y WhatsApp. Recorre los formularios,
catálogo, pausa/reactivación/eliminación y retorno desde login a 320, 375, 768 y 1280 px;
no crea cuentas reales, publica productos remotos ni envía mensajes.

Resultados locales de esta implementación: 51 pruebas de aplicación, 133
comprobaciones de PostgreSQL y 120 comprobaciones de Chromium correctas. Chromium
comprueba formularios dinámicos, borradores, aprobación, catálogo, orden y
actualización de precios en móvil/escritorio con respuestas simuladas; TypeScript
y build de Vercel correctos. El usuario aplicó la segunda migración al proyecto
alojado: `jama_public_catalog` devuelve HTTP 200 y un catálogo vacío, con hora del
servidor. Auth permite registro sin confirmación. Las consultas anónimas a perfiles,
negocios privados y contacto de ofertas están bloqueadas. Vercel confirmó el
despliegue anterior de producción como Ready, con alias `https://jamaweb.vercel.app`.
La migración 202610100003 ya está disponible en ese proyecto: la consulta de
`jama_categories` devuelve HTTP 200 con siete categorías activas y el catálogo
público devuelve HTTP 200 sin ofertas disponibles. La función de comprobación
del administrador deniega acceso anónimo (401/42501). La asignación de la cuenta
administradora debe comprobarse iniciando sesión con ella en `/administracion`. Las pruebas reales de publicación/Storage/RLS
con cuentas de vendedores siguen pendientes; los resultados locales no las sustituyen.

Con las tres migraciones aplicadas y un administrador asignado, verificar:

1. Registrarse sin confirmación, entrar, recargar y cerrar sesión.
2. Negocio sin WhatsApp/WhatsApp inválido: publicación bloqueada.
3. Negocio A: guardar un borrador con foto real; confirmar que siga oculto y que no
   permita publicar sin aprobación. Revisar con el administrador, aprobar y publicar.
   Confirmar como visitante la vigencia, el precio y el orden por descuento.
4. Negocio B: intentar consultar/modificar ofertas privadas y archivos de A mediante
   la API autenticada; las políticas deben negar la operación.
5. Comprobar editar, pausar, programar, agotar, vencer, reactivar y eliminar.
6. Contactar como visitante: el acceso lleva a Inicio. Abrir de nuevo el detalle y
   verificar WhatsApp del
   negocio con mensaje y precio correctos. El mensaje se envía solo si el usuario decide.
7. Intentar solicitar una oferta recién pausada/vencida desde una pestaña antigua:
   la verificación debe rechazarla. Comprobar que contactar no cambia stock ni crea pedidos.
8. Probar tamaños/formato falsificados y fotos ajenas, además de perfiles privados.
9. Revisar móvil real, teclado y Safari/iOS; Chromium por sí solo no los sustituye.

Revisar el texto `/legal` y el correo `hola@jama.pe` según los datos reales del
responsable antes de abrir esta funcionalidad al público.

La revisión de seguridad y el plan de RLS se documentan en `docs/SECURITY.md`.
Tras generar el build, ejecutar `node scripts/audit-security.mjs`. El inventario
remoto de permisos está en `supabase/security_audit.sql` y no modifica datos.
