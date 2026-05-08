import type { Metadata } from "next";
import "./globals.css";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";

export const metadata: Metadata = {
  title: "IPHIPI — Adaptive Mock Interviewer",
  description:
    "Agentic AI mock interview platform. Resume → role inference → adaptive multimodal interview → coaching.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="grain min-h-screen font-sans antialiased">
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
