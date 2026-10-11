import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/jama/AppShell";

export const Route = createFileRoute("/legal")({
  head: () => ({ meta: [{ title: "Términos y privacidad — JAMA" }] }),
  component: () => (
    <AppShell>
      <article className="mx-auto max-w-2xl space-y-5 px-4 py-6 text-sm leading-relaxed">
        <h1 className="text-3xl font-black">Términos y privacidad</h1>
        <section id="terminos" className="scroll-mt-20 space-y-2">
          <h2 className="text-xl font-black">Condiciones de uso</h2>
          <p>
            Puedes explorar JAMA y preparar tu carrito sin registrarte. Para solicitar un descuento
            por WhatsApp, acceder al checkout o publicar ofertas necesitas una cuenta. Mantén tus
            datos actualizados y utiliza únicamente una cuenta que te pertenezca.
          </p>
          <p>
            Los precios y la disponibilidad deben verificarse antes de pagar. Agregar un producto al
            carrito o iniciar sesión no reserva stock ni confirma una compra. Actualmente no se
            procesan pagos en esta plataforma. La disponibilidad final, el pago y el recojo se
            acuerdan directamente con el negocio por WhatsApp. Abrir ese contacto no confirma una
            reserva.
          </p>
          <p>
            Los vendedores deben publicar fotos y datos de sus propios productos, precios reales y
            una vigencia válida. Cada negocio mantiene actualizado su stock y su WhatsApp comercial.
            Los negocios pueden publicar directamente, sin aprobación previa. JAMA puede suspender
            negocios que incumplan las condiciones. Las ofertas pausadas, vencidas, agotadas o de
            negocios suspendidos dejan de mostrarse como disponibles.
          </p>
        </section>
        <section id="privacidad" className="scroll-mt-20 space-y-2">
          <h2 className="text-xl font-black">Política de privacidad</h2>
          <p>
            Para gestionar tu cuenta se utilizan tu nombre, correo y, si decides agregarlo,
            teléfono. Supabase gestiona la autenticación y almacena tu perfil. JAMA no guarda tu
            contraseña en sus tablas.
          </p>
          <p>
            La sesión se conserva en este navegador. El carrito y los favoritos se almacenan
            localmente y pueden permanecer después de cerrar sesión. En un dispositivo compartido,
            cierra sesión y elimina los datos del navegador cuando termines.
          </p>
          <p>
            Si registras un negocio, su nombre, dirección o zona y ofertas serán públicos durante la
            publicación. El WhatsApp comercial se comparte con los clientes que solicitan
            descuentos. Las fotos se alojan en un almacenamiento público y sus enlaces pueden seguir
            accesibles cuando la oferta venza o se pause. Al abrir WhatsApp se aplican también las
            condiciones de ese servicio; JAMA no envía el mensaje automáticamente.
          </p>
          <p>
            Puedes actualizar tu perfil en Mi cuenta. Para solicitar la eliminación de tu cuenta o
            consultar el tratamiento de tus datos, escribe a{" "}
            <a href="mailto:hola@jama.pe" className="underline">
              hola@jama.pe
            </a>
            . No utilizamos los datos de registro para confirmar pagos ni para realizar cobros.
          </p>
        </section>
        <p className="text-muted-foreground">Versión: 10 de octubre de 2026.</p>
      </article>
    </AppShell>
  ),
});
