# Seguridad de JAMA

## Plan de RLS y revisión

1. Aplicar en orden las migraciones versionadas de `supabase/migrations`.
   No borrar tablas, usuarios ni ofertas. La migración `202610100003` añade
   categorías y revisión de negocios; los negocios existentes quedan pendientes
   de aprobación y sus ofertas se conservan. La migración 004 sustituye esa
   revisión previa por publicación directa: habilita nuevos y pendientes, mantiene
   los bloqueados y respeta borradores y pausas.
2. Asignar el primer administrador desde el SQL Editor siguiendo
   `docs/SUPABASE.md`. La función del usuario se comprueba en la base de datos;
   editar metadata del perfil no otorga permisos.
3. Ejecutar `supabase/security_audit.sql` en el SQL Editor. Es una consulta de
   solo lectura que muestra RLS, políticas, permisos por columna y funciones.
   Revisar también las políticas ajenas a JAMA sobre `storage.objects`, porque
   las políticas permisivas se combinan.
4. Verificar con dos cuentas de vendedores el aislamiento de ofertas y fotos,
   y con una cuenta de administrador la suspensión y habilitación. Estas pruebas alojadas
   complementan las pruebas locales y requieren las migraciones aplicadas.
5. Antes de publicar, ejecutar las comprobaciones siguientes.

| Recurso         | Lectura                                                                      | Escritura                                                                     |
| --------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Perfiles        | Solo el propio usuario                                                       | Solo su perfil                                                                |
| Negocios        | Propietario y administrador                                                  | Propietario: campos permitidos; suspensión/habilitación: RPC de administrador |
| Ofertas         | Públicas: vigentes, con stock y negocio habilitado; propietario: sus ofertas | Solo propietario, con validación de precios, stock y horarios en PostgreSQL   |
| Categorías      | Categorías activas                                                           | Solo administrador                                                            |
| Administradores | Sin acceso directo desde el cliente                                          | Asignación administrativa desde SQL Editor                                    |
| Fotos           | Imágenes públicas de ofertas; objetos privados según política                | Carpeta del propietario, validación de tipo y tamaño                          |

Las operaciones de contacto y checkout verifican sesión, habilitación, precios,
stock y vigencia en la base de datos. El catálogo público no devuelve el WhatsApp
privado del negocio. Las funciones privilegiadas fijan `search_path` y limitan
quién puede ejecutarlas.

## Variables y archivos sensibles

`.env.local` está ignorado por Git. `.env.example` contiene únicamente nombres y
valores de ejemplo. Las variables `VITE_` se incluyen en el navegador: usar solo
la URL de Supabase y su clave pública publishable/anon. No colocar claves
`service_role`, `sb_secret_`, contraseñas ni credenciales administrativas allí.

```sh
npm test
npm run test:db
npx tsc --noEmit
VERCEL=1 npm run build
node scripts/audit-security.mjs
```

El último comando revisa los archivos de código incluidos por Git, nombres de
archivos `.env` en el historial, patrones de credenciales privadas y el paquete
público de Vercel. También compara valores privados locales con ese paquete.
Solo informa rutas, líneas y tipos de hallazgo; no imprime valores sensibles.
Exige generar el build primero. Un resultado sin hallazgos describe el alcance
de esta revisión, no prueba la ausencia de todo secreto posible ni sustituye
la revisión de las políticas del proyecto alojado.

## Estado comprobado

Las pruebas locales de PostgreSQL verifican RLS en las tablas de JAMA y Storage,
aislamiento entre vendedores, permisos administrativos, visibilidad pública y
validaciones del backend. La revisión de archivos no encontró credenciales
privadas con los patrones examinados ni archivos `.env` privados en el historial.
Las consultas anónimas alojadas a perfiles y negocios fueron rechazadas.

La migración `202610100003` ya está disponible en el proyecto alojado:
`jama_categories` devuelve HTTP 200 con siete categorías activas y el catálogo
responde correctamente. La asignación administrativa debe comprobarse con la
cuenta elegida en `/administracion`. El inventario administrativo remoto y las
pruebas con dos vendedores siguen pendientes; las comprobaciones anónimas no
sustituyen esa revisión.

La migración `202610110004` es necesaria para la publicación directa y está
pendiente de confirmación en el proyecto alojado. Mantiene RLS y los permisos
que impiden modificar otros negocios o levantar una suspensión desde el cliente.
