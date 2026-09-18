import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "METRA — Legal Metrology Inspection System",
  description: "AI-Assisted compliance inspection for packaged commodities under Legal Metrology Act, 2009. SIH26034.",
  keywords: ["Legal Metrology", "LMPC", "Packaged Commodities", "Compliance", "India"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
