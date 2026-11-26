import type { Metadata } from "next";
import { Inter, Instrument_Serif, JetBrains_Mono, Caveat } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
});
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-caveat",
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
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${inter.variable} ${instrumentSerif.variable} ${caveat.variable} ${jetbrainsMono.variable} font-sans antialiased bg-[#0b0a09] text-[#f5f2eb] min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}
