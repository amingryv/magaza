import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter-tight";
import "./globals.css";
import { springCurve } from "@/lib/spring-curve";

// The build holds no shop data: the Worker replaces the title, description,
// theme colour and Open Graph tags on every response (worker/html.ts).
export const metadata: Metadata = {
  title: "Mağaza",
  description: "",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

// A true spring, computed once at build time, used by every CSS transition.
const SPRING = springCurve(240, 15).easing;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Brand colours come from the Worker as <style id="brand"> (defaults in
  // globals.css); <html lang> is set per page, so React must not fight it.
  return (
    <html lang="az" style={{ "--spring": SPRING } as React.CSSProperties} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
