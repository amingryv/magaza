import { Suspense } from "react";
import { SentView } from "@/views/SentView";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-[60dvh]" />}>
      <SentView />
    </Suspense>
  );
}
