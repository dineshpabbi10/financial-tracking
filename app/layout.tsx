import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: {
    default: "Loonie — Canadian personal finance",
    template: "%s · Loonie",
  },
  description:
    "A private, installable personal finance dashboard for Canadian bank accounts. Track spending, budgets, and upcoming bills.",
  applicationName: "Loonie",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Loonie",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0f3d2c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-CA">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
