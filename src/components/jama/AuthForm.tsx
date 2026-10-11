import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { LoaderCircle, LogIn } from "lucide-react";
import { AuthActionError, submitAuth, type AuthMode } from "@/lib/auth-actions";
import { getSupabaseConfig } from "@/lib/supabase";
import { useAuth, type AuthNext } from "@/lib/auth";

export function AuthForm({ mode, next }: { mode: AuthMode; next: AuthNext }) {
  const { session } = useAuth();
  const [values, setValues] = useState({
    name: "",
    email: "",
    password: "",
    confirmation: "",
    accepted: false,
  });
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const configured = !!getSupabaseConfig();
  const title = {
    login: "Iniciar sesión",
    register: "Crear cuenta",
    recover: "Recuperar contraseña",
    reset: "Nueva contraseña",
  }[mode];
  const fieldClass =
    "min-h-11 w-full min-w-0 rounded-xl border bg-card px-3 text-base outline-none focus:ring-2 focus:ring-ring sm:min-h-12 sm:px-4";
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    setMessage("");
    try {
      setMessage(await submitAuth(mode, values, next));
      setValues((current) => ({ ...current, password: "", confirmation: "" }));
    } catch (err) {
      setError(
        err instanceof AuthActionError
          ? err.message
          : "No pudimos completar la solicitud. Inténtalo nuevamente.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <div className="min-w-0 rounded-3xl bg-card p-4 shadow-soft sm:p-7">
      <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-lime sm:size-14">
        <LogIn className="size-7" />
      </span>
      <h1 className="text-2xl font-black">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {mode === "login" || mode === "register"
          ? "Accede a tu cuenta para comprar y gestionar tus datos. Al ingresar irás al inicio de JAMA."
          : "Tu cuenta para comprar y gestionar tus datos en JAMA."}
      </p>
      {!configured && (
        <p role="status" className="mt-4 rounded-xl bg-muted p-3 text-sm">
          El acceso a cuentas estará disponible pronto. Puedes seguir explorando las ofertas.
        </p>
      )}
      {mode === "reset" && !session && (
        <p role="status" className="mt-4 text-sm">
          Abre el enlace de recuperación que recibiste por correo para continuar.
        </p>
      )}
      <form onSubmit={submit} className="mt-4 min-w-0 space-y-3 sm:mt-5 sm:space-y-4">
        <fieldset
          disabled={pending || !configured || (mode === "reset" && !session)}
          className="min-w-0 space-y-3 disabled:opacity-60 sm:space-y-4"
        >
          {mode === "register" && (
            <label className="block space-y-1 text-sm font-bold">
              Nombre completo
              <input
                required
                autoComplete="name"
                maxLength={120}
                value={values.name}
                onChange={(e) => setValues({ ...values, name: e.target.value })}
                className={fieldClass}
              />
            </label>
          )}
          {mode !== "reset" && (
            <label className="block space-y-1 text-sm font-bold">
              Correo electrónico
              <input
                required
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                value={values.email}
                onChange={(e) => setValues({ ...values, email: e.target.value })}
                className={fieldClass}
              />
            </label>
          )}
          {mode !== "recover" && (
            <label className="block space-y-1 text-sm font-bold">
              Contraseña
              <input
                required
                type="password"
                minLength={mode === "login" ? 1 : 8}
                maxLength={128}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={values.password}
                onChange={(e) => setValues({ ...values, password: e.target.value })}
                className={fieldClass}
              />
            </label>
          )}
          {(mode === "register" || mode === "reset") && (
            <label className="block space-y-1 text-sm font-bold">
              Confirmar contraseña
              <input
                required
                type="password"
                autoComplete="new-password"
                value={values.confirmation}
                onChange={(e) => setValues({ ...values, confirmation: e.target.value })}
                className={fieldClass}
              />
            </label>
          )}
          {mode === "register" && (
            <label className="flex min-h-11 items-start gap-3 text-sm">
              <input
                required
                type="checkbox"
                checked={values.accepted}
                onChange={(e) => setValues({ ...values, accepted: e.target.checked })}
                className="mt-1 size-5 shrink-0 accent-navy"
              />
              <span>
                Acepto los{" "}
                <Link to="/legal" hash="terminos" className="underline">
                  términos
                </Link>{" "}
                y la{" "}
                <Link to="/legal" hash="privacidad" className="underline">
                  política de privacidad
                </Link>
                .
              </span>
            </label>
          )}
          <button
            type="submit"
            className="press flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-lime px-4 py-3 font-black disabled:opacity-50"
          >
            {pending && <LoaderCircle className="size-5 animate-spin" />}
            {pending
              ? "Un momento…"
              : mode === "recover"
                ? "Enviar enlace"
                : mode === "reset"
                  ? "Guardar contraseña"
                  : title}
          </button>
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="rounded-xl bg-muted p-3 text-sm">
            {message}
          </p>
        )}
      </form>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm font-bold">
        {mode !== "login" && (
          <Link
            to="/acceso"
            search={{ mode: "login", next }}
            className="inline-flex min-h-11 items-center underline"
          >
            Iniciar sesión
          </Link>
        )}
        {mode !== "register" && (
          <Link
            to="/acceso"
            search={{ mode: "register", next }}
            className="inline-flex min-h-11 items-center underline"
          >
            Crear cuenta
          </Link>
        )}
        {mode === "login" && (
          <Link
            to="/acceso"
            search={{ mode: "recover", next }}
            className="inline-flex min-h-11 items-center underline"
          >
            Olvidé mi contraseña
          </Link>
        )}
      </div>
      <Link
        to={next === "/checkout" ? "/carrito" : "/explorar"}
        className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-muted-foreground"
      >
        {next === "/checkout" ? "Volver al carrito" : "Seguir explorando"}
      </Link>
    </div>
  );
}
