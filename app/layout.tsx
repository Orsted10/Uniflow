import type { Metadata } from "next";
import { Inter, Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "UNIFLOW — Deterministic API Compatibility Compiler",
  description:
    "Compile breaking API migrations into verified TypeScript adapters across OpenAPI 3.x and JSON Schema.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${bricolage.variable} ${jetbrainsMono.variable} font-sans antialiased bg-[#07080f] text-zinc-100 min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}
