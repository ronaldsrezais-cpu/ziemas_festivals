// Resolve the same Neon compute/database as the application, using its direct
// hostname for migrations. Never persist or log connection credentials.
export function productionMigrationUrl(env) {
  if (env.VERCEL !== '1' || env.VERCEL_ENV !== 'production') return null;
  try {
    const app = new URL(env.DATABASE_URL?.trim());
    if (!['postgres:', 'postgresql:'].includes(app.protocol) || !app.hostname.endsWith('.neon.tech')) throw new Error();
    app.hostname = app.hostname.replace(/-pooler\./, '.');
    const direct = env.DATABASE_URL_UNPOOLED?.trim() ? new URL(env.DATABASE_URL_UNPOOLED.trim()) : app;
    if (!['postgres:', 'postgresql:'].includes(direct.protocol) || direct.hostname !== app.hostname || direct.pathname !== app.pathname) throw new Error();
    return direct.toString();
  } catch {
    throw new Error('Produkcijas migrācijai vajadzīgs derīgs DATABASE_URL; DATABASE_URL_UNPOOLED jānorāda uz to pašu Neon datubāzi.');
  }
}
