import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reporting Connector",
  description: "Operational console for Airbyte to Supabase and BigQuery reporting pipelines"
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
