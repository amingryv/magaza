import type { Metadata } from "next";

// The admin panel is never indexed. It is one client app (src/admin).
export const metadata: Metadata = {
  title: "İdarə paneli",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
