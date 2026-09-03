import { PublicDashboard } from "@/components/public-dashboard";
import { SiteShell } from "@/components/site-shell";

export default function Home() {
  return <SiteShell><PublicDashboard /></SiteShell>;
}
