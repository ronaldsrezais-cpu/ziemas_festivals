import { PublicDashboard } from "@/components/public-dashboard";
import { SiteShell } from "@/components/site-shell";

export default function Home() {
  return <SiteShell><PublicDashboard configured={Boolean(process.env.DATABASE_URL)} /></SiteShell>;
}
