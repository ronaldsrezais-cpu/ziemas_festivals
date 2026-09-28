export const state = { session: null, rows: [], reads: 0 };

export async function getSession(requiredRole) {
  return state.session?.role === requiredRole ? state.session : null;
}

// In-memory boundary for route tests: no production database or contact data is used.
export function getDb() {
  state.reads += 1;
  const query = {
    from() { return query; },
    innerJoin() { return query; },
    async orderBy() { return structuredClone(state.rows); },
  };
  return { select() { return query; } };
}
