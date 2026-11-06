import { Suspense } from "react";
import { PageView } from "@/views/PageView";

// One static shell for every owner page ("About", "Delivery", ...): the slug
// comes from ?s=, so pages the owner adds open without a rebuild.
export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-[60dvh]" />}>
      <PageView />
    </Suspense>
  );
}
