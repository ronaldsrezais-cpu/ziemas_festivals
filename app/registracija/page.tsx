import { SchoolRegistration } from "@/components/school-registration";
import { SiteShell } from "@/components/site-shell";

export default function RegistrationPage() { return <SiteShell><SchoolRegistration configured={Boolean(process.env.DATABASE_URL)} /></SiteShell>; }
