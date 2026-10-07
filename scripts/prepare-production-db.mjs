import { spawnSync } from 'node:child_process';
import { productionMigrationUrl } from './production-migration-config.mjs';

try {
  const url = productionMigrationUrl(process.env);
  if (url) {
    console.log('Pārbauda produkcijas datubāzes migrācijas.');
    const result = spawnSync(process.execPath, ['scripts/migrate.mjs'], {
      stdio: 'inherit', env: { ...process.env, DATABASE_URL_UNPOOLED: url }, timeout: 120_000,
    });
    if (result.error || result.status !== 0) {
      console.error('Publicēšana apturēta: datubāzes migrācija nav pabeigta.');
      process.exit(1);
    }
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
