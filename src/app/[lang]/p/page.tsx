import { Suspense } from "react";
import { ProductView } from "@/views/ProductView";

// One static shell for every product: the slug comes from ?s=, so products
// the owner adds later open without rebuilding the site.
export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-[80dvh]" />}>
      <ProductView />
    </Suspense>
  );
}
