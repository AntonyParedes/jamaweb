import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchCatalog } from "./offers-api";
import { availableProducts } from "./products";

export function useCatalog() {
  const query = useQuery({
    queryKey: ["jama-catalog"],
    queryFn: async () => {
      const result = await fetchCatalog();
      if (!result.ok) throw new Error(result.message);
      return { ...result.value, receivedAt: performance.now() };
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => tick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
  // Anchor the clock to the database, never the shopper's wall clock.
  const now = query.data
    ? Date.parse(query.data.serverNow) + Math.max(0, performance.now() - query.data.receivedAt)
    : 0;
  return {
    products: availableProducts(query.data?.items ?? [], now),
    loading: query.isPending,
    error: query.error?.message ?? "",
    refresh: query.refetch,
  };
}
