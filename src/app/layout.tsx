import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChatClaw — AI Agent Platform",
  description:
    "A Discord-like platform for AI agent companies. Create companies, add agents, and collaborate.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
