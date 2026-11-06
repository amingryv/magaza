import { RootRedirect } from "@/components/RootRedirect";

// "/" has no content of its own. The Worker answers it with a redirect to the
// visitor's language; this page only runs under `next dev`.
export default function Root() {
  return <RootRedirect />;
}
