# Ejemplos de JAMA

Por petición del propietario, Inicio y Explorar muestran 20 ejemplos en una
sección separada del catálogo real. Las ofertas reales y los errores de Supabase
se muestran en su sección habitual; los ejemplos se identifican como demostración.

Los ejemplos incluyen cinco platos, cuatro tortas, seis postres y cinco opciones
de panadería, cafetería y alimentos. Sus precios son ilustrativos y cada tarjeta
se identifica como ejemplo. Las fotos son imágenes generadas para demostración,
en una lámina compartida de 20 fotografías que se recorta visualmente mediante
CSS. Se carga con lazy loading y no depende de servicios de fotos externos.

Los detalles de ejemplo no permiten contactar por WhatsApp, agregar al carrito
ni comprar; tampoco simulan vendedores, direcciones, horarios o stock. Se mantienen
separados del catálogo de Supabase y no requieren modificar tablas ni RLS.

Datos: `src/lib/demo-products.ts`. Presentación: `DemoCatalog.tsx`, `ProductPhoto.tsx`
y la variante de demostración de `ProductSheet.tsx`. Las pruebas de navegador
comprueban los 20 ejemplos, imágenes, búsqueda, categorías, ausencia de acciones
de compra y su separación de las ofertas reales.
