export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-discord-dark px-6 text-center text-white">
      <div>
        <h1 className="text-3xl font-semibold">Page not found</h1>
        <p className="mt-3 text-sm text-discord-muted">
          The page you requested does not exist.
        </p>
      </div>
    </main>
  );
}
