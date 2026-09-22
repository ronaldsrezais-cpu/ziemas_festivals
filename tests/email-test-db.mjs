// Isolated adapter for email contract tests. No network or real credentials.
import { createHash } from 'node:crypto';

const table = (name, keys) => Object.fromEntries([['_table', name], ...keys.map(key => [key, { key }])]);
export const schools = table('schools', ['id', 'accessCodeHash']);
export const emailOutbox = table('emails', ['id', 'schoolId', 'status', 'lastAttemptAt', 'attemptCount']);
export const settings = table('settings', ['key']);
export const participants = table('participants', ['id', 'schoolId', 'active']);
export const leaders = table('leaders', ['id', 'schoolId']);
export const entries = table('entries', ['id', 'schoolId', 'participantId', 'categoryId']);
export const categories = table('categories', ['id', 'sportId', 'active']);
export const sports = table('sports', ['id']);
export const results = table('results', ['entryId']);
export const eq = (field, value) => ({ op: 'eq', field, value });
export const inArray = (field, value) => ({ op: 'in', field, value });
export const lt = (field, value) => ({ op: 'lt', field, value });
export const and = (...conditions) => ({ op: 'and', conditions });
export const or = (...conditions) => ({ op: 'or', conditions });
export const desc = field => field;
export const sql = (strings, field) => ({ increment: field.key });
export const sha256 = async value => createHash('sha256').update(value).digest('hex');
export const accessCodeHash = code => sha256(`${code.trim().toUpperCase()}:test-secret`);
export const createAccessCode = () => 'ABCDEFGH';
export const state = { schools: [], emails: [], settings: [], participants: [], leaders: [], entries: [], env: {} };
export const runtimeEnv = () => state.env;

function matches(row, condition) {
  if (!condition) return true;
  if (condition.op === 'and') return condition.conditions.every(item => matches(row, item));
  if (condition.op === 'or') return condition.conditions.some(item => matches(row, item));
  const actual = row[condition.field.key];
  if (condition.op === 'eq') return actual === condition.value;
  if (condition.op === 'in') return condition.value.includes(actual);
  if (condition.op === 'lt') return actual !== null && actual < condition.value;
  throw new Error('Unsupported test condition');
}

const db = {
  select() {
    return { from(table) {
      let condition;
      const rows = () => state[table._table].filter(row => matches(row, condition)).map(row => ({ ...row }));
      const query = {
        where(value) { condition = value; return query; },
        orderBy() { return query; },
        limit(count) { return Promise.resolve(rows().sort((a, b) => b.id - a.id).slice(0, count)); },
        for() { return Promise.resolve(rows()); },
        then(resolve, reject) { return Promise.resolve(rows()).then(resolve, reject); },
      };
      return query;
    } };
  },
  update(table) {
    return { set(values) { return { where(condition) {
      // Evaluate the condition and update synchronously, like one SQL UPDATE.
      const apply = () => state[table._table].filter(row => matches(row, condition)).map(row => {
        for (const [key, value] of Object.entries(values)) {
          row[key] = value?.increment ? row[value.increment] + 1 : value;
        }
        return { ...row };
      });
      return { returning: async () => apply(), then: (resolve, reject) => Promise.resolve().then(apply).then(resolve, reject) };
    } }; } };
  },
  insert(table) {
    return { values(value) { return { returning: async () => {
      const rows = state[table._table];
      const row = { id: Math.max(0, ...rows.map(item => item.id)) + 1, status: 'queued', error: null,
        attemptCount: 0, sentAt: null, lastAttemptAt: null, ...value };
      rows.push(row);
      return [{ ...row }];
    } }; } };
  },
  delete(table) {
    return { where(condition) { return { returning: async () => {
      const removed = state[table._table].filter(row => matches(row, condition));
      state[table._table] = state[table._table].filter(row => !matches(row, condition));
      return removed;
    } }; } };
  },
};

export const getDb = () => db;
let queue = Promise.resolve();
export async function withTransaction(work) {
  const previous = queue;
  let release;
  queue = new Promise(resolve => { release = resolve; });
  await previous;
  try { return await work(db); } finally { release(); }
}

export async function resetEmailState() {
  state.env = { RESEND_API_KEY: 'unit-test-only', EMAIL_FROM: 'Festival <noreply@example.test>' };
  state.schools = [{ id: 1, name: 'Testa skola', email: 'teacher@example.test', status: 'approved',
    accessCodeHash: await accessCodeHash('ABCDEFGH') }];
  state.emails = [{ id: 1, schoolId: 1, recipient: 'teacher@example.test', subject: 'Apstiprinājums',
    body: 'Labdien!\nSkolas piekļuves kods: ABCDEFGH\n', status: 'queued', error: null,
    attemptCount: 0, lastAttemptAt: null, sentAt: null }];
}
