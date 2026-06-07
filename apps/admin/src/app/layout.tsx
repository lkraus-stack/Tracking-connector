import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tracking Connector Admin",
  description: "Admin console for TikTok and Microsoft Ads reporting pipelines via Airbyte and BigQuery"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
