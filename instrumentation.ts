export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { ensureSingletons } = await import('./lib/db');
    await ensureSingletons();
  }
}
