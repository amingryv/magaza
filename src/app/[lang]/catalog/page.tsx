import { Suspense } from "react";
import { CatalogView } from "@/views/CatalogView";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-[70dvh]" />}>
      <CatalogView />
    </Suspense>
  );
}
