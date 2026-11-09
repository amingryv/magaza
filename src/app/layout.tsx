import type { Metadata, Viewport } from "next";
import "@fontsource-variable/geist";
// the owner's other font choices (theme.font); a face downloads only when used
import "@fontsource-variable/inter-tight";
import "@fontsource-variable/manrope";
import "@fontsource-variable/montserrat";
import "@fontsource-variable/onest";
import "@fontsource-variable/playfair-display";
import "./globals.css";
import { springCurve } from "@/lib/spring-curve";

// The build holds no shop data: the Worker writes the title and replaces the
// description, theme colour and Open Graph tags on every response
// (worker/html.ts). No title here: React would put it back after loading.
export const metadata: Metadata = {
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
