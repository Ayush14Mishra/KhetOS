import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://ayush14mishra.github.io"),
  title: "KhetOS — Field intelligence for safer farming",
  description:
    "Offline-first crop microclimate, safety, scheme and market intelligence for small farms.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "KhetOS — Field intelligence for safer farming",
    description: "Offline-first field monitoring, explainable alerts and safer crop decisions.",
    url: "/KhetOS/",
    siteName: "KhetOS",
    type: "website",
    images: [{ url: "/KhetOS/og.png", width: 1200, height: 630, alt: "KhetOS — Field intelligence for safer farming" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "KhetOS — Field intelligence for safer farming",
    description: "Offline-first field monitoring, explainable alerts and safer crop decisions.",
    images: ["/KhetOS/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hi" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
