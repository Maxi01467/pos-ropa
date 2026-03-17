export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
          Sin conexion
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          No pudimos cargar la aplicacion
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Verifica tu red y vuelve a intentarlo. Si ya abriste modulos antes,
          algunos recursos seguiran disponibles desde cache.
        </p>
      </section>
    </main>
  );
}
