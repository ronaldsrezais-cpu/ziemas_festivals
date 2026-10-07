import test from 'node:test';
import assert from 'node:assert/strict';
import { productionMigrationUrl } from '../scripts/production-migration-config.mjs';

const url = 'postgresql://test:fixture-only@ep-fixture-pooler.c-6.eu-central-1.aws.neon.tech/neondb?sslmode=require';
const direct = url.replace('-pooler.', '.');
const production = { VERCEL: '1', VERCEL_ENV: 'production', DATABASE_URL: url };
test('local and preview builds never migrate a database', () => {
  for (const env of [{}, { DATABASE_URL: url }, { ...production, VERCEL: '' }, { ...production, VERCEL_ENV: 'preview' }, { ...production, VERCEL_ENV: 'development' }])
    assert.equal(productionMigrationUrl(env), null);
});
test('production migration stays on the application database and preserves connection parameters', () => {
  assert.equal(productionMigrationUrl(production), direct);
  assert.equal(productionMigrationUrl({ ...production, DATABASE_URL: direct }), direct);
  assert.equal(productionMigrationUrl({ ...production, DATABASE_URL_UNPOOLED: direct }), direct);
});
test('invalid or mismatched production targets fail closed without exposing credentials', () => {
  for (const env of [{ ...production, DATABASE_URL: '' }, { ...production, DATABASE_URL: 'https://attacker.test' },
    { ...production, DATABASE_URL_UNPOOLED: direct.replace('/neondb?', '/another?') },
    { ...production, DATABASE_URL_UNPOOLED: direct.replace('ep-fixture.', 'ep-other.') }]) {
    assert.throws(() => productionMigrationUrl(env), error => error.message.includes('migrācijai') && !error.message.includes('fixture-only'));
  }
});
