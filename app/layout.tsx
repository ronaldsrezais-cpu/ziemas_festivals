import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ziemas festivāls | Reģistrācija un rezultāti",
  description: "Latvijas skolu Ziemas festivāla skolu reģistrācija, dalībnieku saraksti un rezultāti.",
  icons: { icon: "/brand/symbol.svg", shortcut: "/brand/symbol.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="lv"><body>{children}</body></html>;
}
