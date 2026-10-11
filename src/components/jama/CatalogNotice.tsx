export function CatalogNotice({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: string;
  retry: () => unknown;
}) {
  if (loading)
    return (
      <p role="status" className="py-6 text-sm text-muted-foreground">
        Cargando ofertas…
      </p>
    );
  if (error)
    return (
      <div role="alert" className="space-y-2 rounded-2xl bg-muted p-4 text-sm">
        <p>{error}</p>
        <button onClick={retry} className="min-h-11 font-bold underline">
          Volver a intentar
        </button>
      </div>
    );
  return null;
}
