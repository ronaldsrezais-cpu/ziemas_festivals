export function runtimeEnv() {
  return {
    AUTH_SECRET: process.env.AUTH_SECRET,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
  };
}
