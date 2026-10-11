import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { fetchAdminAccess } from "@/lib/business-review-api";

export function AdminLink() {
  const { session, recovery } = useAuth();
  const query = useQuery({
    queryKey: ["jama-admin-access", session?.user.id],
    enabled: !!session && !recovery,
    queryFn: async () => {
      if (!session) return false;
      const result = await fetchAdminAccess({ data: { accessToken: session.access_token } });
      return result.ok && result.value;
    },
    retry: false,
  });
  if (!session || recovery || query.data !== true) return null;
  return (
    <Link to="/administracion" className="flex min-h-11 items-center font-bold underline">
      Revisar negocios
    </Link>
  );
}
