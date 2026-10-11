import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";

type AuthState = { session: Session | null; loading: boolean; recovery: boolean };
const AuthContext = createContext<AuthState>({ session: null, loading: true, recovery: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true, recovery: false });
  useEffect(() => {
    const client = getSupabase();
    if (!client) {
      setState({ session: null, loading: false, recovery: false });
      return;
    }
    let active = true;
    let changed = false;
    const { data } = client.auth.onAuthStateChange((event, session) => {
      changed = true;
      if (active)
        setState((previous) => ({
          session,
          loading: false,
          recovery: event === "PASSWORD_RECOVERY" || (event !== "SIGNED_OUT" && previous.recovery),
        }));
    });
    void client.auth
      .getSession()
      .then(({ data: result, error }) => {
        if (active && !changed)
          setState({ session: error ? null : result.session, loading: false, recovery: false });
      })
      .catch(() => {
        if (active && !changed) setState({ session: null, loading: false, recovery: false });
      });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export type AuthNext = "/checkout" | "/cuenta" | "/vender" | `/oferta/${string}`;
export function safeNext(value: unknown): AuthNext {
  if (value === "/checkout" || value === "/vender") return value;
  if (
    typeof value === "string" &&
    /^\/oferta\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      value,
    )
  )
    return value as `/oferta/${string}`;
  return "/cuenta";
}

export function authErrorMessage(code?: string): string {
  if (code === "email_not_confirmed")
    return "Revisa tu correo y confirma tu cuenta antes de ingresar.";
  if (code === "weak_password") return "Elige una contraseña más segura, de al menos 8 caracteres.";
  if (code === "over_email_send_rate_limit")
    return "Se alcanzó el límite de envío de correos. Espera a que se restablezca antes de solicitar otro enlace.";
  if (code === "over_request_rate_limit")
    return "Espera unos minutos antes de volver a intentarlo.";
  return "No pudimos completar el acceso. Revisa tus datos e inténtalo nuevamente.";
}
