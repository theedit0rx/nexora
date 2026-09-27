import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "NEXORA — Autonomous Digital Agency OS",
    template: "%s · NEXORA",
  },
  description:
    "NEXORA is an autonomous AI-powered digital agency operating system. Find. Build. Sell. Deliver. Automatically.",
  applicationName: "NEXORA",
  authors: [{ name: "Sajid Raza" }],
  keywords: ["AI agency", "autonomous agency", "lead generation", "website generation", "CRM"],
};

export const viewport: Viewport = {
  themeColor: "#07090d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          rel="icon"
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%236366f1'/%3E%3Cpath d='M18 44 32 16l14 28h-8l-6-12-6 12z' fill='white'/%3E%3C/svg%3E"
        />
      </head>
      <body className="min-h-screen bg-base text-ink antialiased">{children}</body>
    </html>
  );
}
