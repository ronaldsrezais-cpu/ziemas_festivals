import { AdminAccreditationSheets } from "@/components/print-documents";

export default async function AdminAccreditationsPage({ searchParams }: {
  searchParams: Promise<{ group?: string | string[] }>;
}) {
  const { group } = await searchParams;
  const initialGroup = group === "participants" || group === "leaders" || group === "judges" ? group : "all";
  return <AdminAccreditationSheets key={initialGroup} initialGroup={initialGroup} />;
}
