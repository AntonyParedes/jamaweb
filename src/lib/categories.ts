import { useQuery } from "@tanstack/react-query";
import { fetchCategories } from "./offers-api";

export function useCategories() {
  const query = useQuery({
    queryKey: ["jama-categories"],
    queryFn: async () => {
      const result = await fetchCategories();
      if (!result.ok) throw new Error(result.message);
      return result.value;
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  return {
    categories: query.data ?? [],
    loading: query.isPending,
    error: query.error?.message ?? "",
    refresh: query.refetch,
  };
}
