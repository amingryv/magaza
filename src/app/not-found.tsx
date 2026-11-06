import { DICTS, LANGS } from "@/lib/i18n";

// Served as 404.html for any unknown address. The shop's name is written in
// by the Worker ([data-store="name"]).
export default function NotFound() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-paper px-5 py-16 text-center">
      <div className="relative max-w-lg">
        <p className="accent-text text-[6rem] font-[800] leading-none tracking-[-0.06em]">404</p>
        {LANGS.map((l) => (
          <div key={l} lang={l} className="mt-6">
            <h1 className="text-2xl">{DICTS[l].notFound.title}</h1>
            <p className="mt-1 text-ink-soft">{DICTS[l].notFound.lead}</p>
            <a href={`/${l}/`} className="pill pill-soft mt-3 !h-11">
              <span data-store="name" />
              <span aria-hidden> · </span>
              {DICTS[l].nav.home}
            </a>
          </div>
        ))}
      </div>
    </main>
  );
}
