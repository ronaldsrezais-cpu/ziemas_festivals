export const cookieState = { value: null, options: null };
export async function cookies() {
  return {
    get: () => cookieState.value ? { value: cookieState.value } : undefined,
    set(_name, value, options) { Object.assign(cookieState, { value, options }); },
    delete() { cookieState.value = null; },
  };
}
