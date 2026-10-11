import { z } from "zod";
import { getSupabase } from "./supabase";
import { authErrorMessage, safeNext } from "./auth";

export const signupSchema = z
  .object({
    name: z.string().trim().min(3, "Escribe tu nombre completo.").max(120),
    email: z.string().trim().email("Escribe un correo válido."),
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres.").max(128),
    confirmation: z.string(),
    accepted: z.literal(true, {
      errorMap: () => ({
        message: "Acepta los términos y la política de privacidad para continuar.",
      }),
    }),
  })
  .refine((data) => data.password === data.confirmation, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmation"],
  });

export class AuthActionError extends Error {}

export type AuthMode = "login" | "register" | "recover" | "reset";
export async function submitAuth(
  mode: AuthMode,
  values: {
    name: string;
    email: string;
    password: string;
    confirmation: string;
    accepted: boolean;
  },
  next: string,
) {
  const client = getSupabase();
  if (!client)
    throw new AuthActionError(
      "El acceso a cuentas estará disponible pronto. Puedes seguir explorando las ofertas.",
    );
  const redirect = new URL("/acceso", window.location.origin);
  redirect.searchParams.set("next", safeNext(next));
  if (mode === "register") {
    const result = signupSchema.safeParse(values);
    if (!result.success)
      throw new AuthActionError(result.error.issues[0]?.message ?? "Revisa tus datos.");
    const { data, error } = await client.auth.signUp({
      email: result.data.email,
      password: result.data.password,
      options: {
        emailRedirectTo: redirect.toString(),
        data: {
          full_name: result.data.name,
          terms_version: "2026-10-10",
          terms_accepted_at: new Date().toISOString(),
        },
      },
    });
    if (error) throw new AuthActionError(authErrorMessage(error.code));
    return data.session
      ? "Tu cuenta está lista."
      : "Revisa tu correo para confirmar tu cuenta. Después regresa a JAMA e inicia sesión; tu carrito seguirá aquí.";
  }
  if (mode === "reset") {
    if (values.password.length < 8 || values.password.length > 128)
      throw new AuthActionError("La contraseña debe tener entre 8 y 128 caracteres.");
    if (values.password !== values.confirmation)
      throw new AuthActionError("Las contraseñas no coinciden.");
    const { data, error: userError } = await client.auth.getUser();
    if (userError || !data.user)
      throw new AuthActionError("Abre el enlace de recuperación que recibiste por correo.");
    const { error } = await client.auth.updateUser({ password: values.password });
    if (error) throw new AuthActionError(authErrorMessage(error.code));
    const { error: signOutError } = await client.auth.signOut();
    if (signOutError)
      throw new AuthActionError(
        "La contraseña se actualizó. Cierra sesión antes de volver a ingresar.",
      );
    return "Contraseña actualizada. Inicia sesión con tu nueva contraseña.";
  }
  const email = z.string().trim().email("Escribe un correo válido.").safeParse(values.email);
  if (!email.success) throw new AuthActionError("Escribe un correo válido.");
  if (mode === "recover") {
    redirect.searchParams.set("mode", "reset");
    const { error } = await client.auth.resetPasswordForEmail(email.data, {
      redirectTo: redirect.toString(),
    });
    // Same result for existing and nonexistent accounts.
    if (error) {
      if (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit")
        throw new AuthActionError(authErrorMessage(error.code));
      throw new AuthActionError(
        "No pudimos enviar el correo. Espera unos minutos e inténtalo nuevamente.",
      );
    }
    return "Si existe una cuenta con ese correo, recibirás un enlace para cambiar tu contraseña.";
  }
  if (!values.password) throw new AuthActionError("Escribe tu contraseña.");
  const { error } = await client.auth.signInWithPassword({
    email: email.data,
    password: values.password,
  });
  if (error) throw new AuthActionError(authErrorMessage(error.code));
  return "Sesión iniciada.";
}
