import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "UNIFLOW ∞ — API Compatibility Compiler",
  description:
    "Deterministic API contract compatibility, validation, and adapter generation across OpenAPI 3.x and JSON Schema.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-[#0b0f17] text-slate-100 min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
