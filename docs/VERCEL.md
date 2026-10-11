# Desplegar JAMA en Vercel

`vercel.json` ya define instalación con Bun y lockfile congelado, build con
`npm run build`, `framework: null` y salida `.vercel/output`. Se conserva porque
el build actual usa TanStack Start + Vite + Nitro, con funciones del servidor.
No añadir rewrites genéricas hacia `index.html`: romperían estas funciones.

`vite.config.ts` selecciona el preset Nitro `vercel` cuando `VERCEL=1` (Vercel
lo establece en su entorno). El build comprobado genera la función `__server`
para Node.js 24. Usar Node 24 y una versión de Bun compatible con `bun.lock`.

## Antes de desplegar

1. Aplicar las tres migraciones y comprobar bucket/políticas siguiendo
   [SUPABASE.md](./SUPABASE.md). La nueva funcionalidad no puede publicar ni mostrar
   ofertas reales hasta aplicar ese SQL. Las cuentas/perfiles ya existentes se reutilizan.
2. Configurar las dos variables de `.env.example` en Vercel, para el entorno de
   destino. Solo Project URL y Publishable key; no service_role ni claves secretas.
3. Comprobar Site URL, redirects y registro sin confirmación en Supabase.
4. Ejecutar instalación congelada, pruebas, `test:db`, TypeScript y build tal como
   se indica en SUPABASE.md. Verificar que existe `.vercel/output/config.json`
   y `.vercel/output/functions/__server.func/.vc-config.json`.
5. Revisar el catálogo de prueba, WhatsApp comercial y texto legal.

## Despliegue de revisión

Desde la raíz del repositorio, con Vercel CLI autenticado y proyecto correcto:

```sh
vercel link
vercel deploy
```

Revisar el proyecto/equipo existente antes de vincular. El proyecto de esta sesión
es `jamaweb`; no reemplazar otro proyecto como `jama`. También se puede desplegar
mediante la integración Git después de publicar los commits autorizados.

El enlace de revisión permite comprobar interfaz y funciones sin cambiar el dominio
principal. Si se usa Auth desde ese dominio, agregar su `/acceso**` a Redirect URLs
sin autorizar dominios ajenos. Comprobar el estado Ready con `vercel inspect <url>`.

El despliegue en producción requiere autorización explícita y debe usar exactamente
la versión revisada. Cambiar código o variables de build requiere otro despliegue;
publicar una oferta o cambiar Confirm email en Supabase no requiere reconstruir.

## Prueba posterior

- Visitante: inicio, explorar, categorías, detalles y favoritos.
- Dueño: registro/login, negocio con WhatsApp, foto y oferta activa; editar/pausar.
- Cliente: botón de descuento, login conservando oferta y contacto correcto por WhatsApp.
- Oferta vencida/pausada: el servidor rechaza el contacto, incluso desde una página antigua.
- Dos dueños: comprobar permisos de ofertas y Storage con identidades distintas.
- Confirmar que no se producen cobros, pedidos ni cambios de stock al contactar.

Las pruebas locales o una página Ready no demuestran que las migraciones ni RLS
estén aplicadas al proyecto remoto. Registrar por separado esos resultados.
