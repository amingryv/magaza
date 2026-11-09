"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useSite } from "@/lib/site";
import { usePage } from "@/lib/api";
import { Markdown } from "@/components/Markdown";
import { WhatsAppIcon } from "@/components/BrandIcons";
import { whatsappLink } from "@/lib/order";

export function PageView() {
  const { t, lang, ctx, href, store, ready } = useSite();
  const slug = useSearchParams().get("s");
  const { page, loading, missing } = usePage(slug);

  const tr = page?.translations?.[lang] as { title?: string; content?: string } | undefined;
  const own = lang === ctx.main;
  const title = page ? (own ? page.title : tr?.title || page.title) : "";
  const content = page ? (own ? page.content : tr?.content || page.content) : "";

  useEffect(() => {
    if (title && ready) document.title = `${title} — ${store.name}`;
  }, [title, store.name, ready]);

  if (loading) return <div className="min-h-[60dvh]" aria-busy />;
  if (missing || !page)
    return (
      <div className="wrap grid min-h-[60dvh] place-items-center py-16 text-center">
        <div>
          <h1 className="text-3xl">{t.notFound.title}</h1>
          <Link href={href("/")} className="pill pill-ink mt-6">
            {t.nav.home}
          </Link>
        </div>
      </div>
    );

  return (
    <article className="wrap pb-16 pt-10 md:pt-20">
      <header className="mx-auto max-w-[44rem] border-b border-ink-line pb-8 text-center md:pb-12">
        <h1 className="page-title">{title}</h1>
      </header>
      <div className="prose-shop mx-auto mt-8 max-w-[40rem] [animation:rise_.6s_var(--curve)] md:mt-12">
        <Markdown text={content} />
      </div>
      {store.whatsapp && (
        <aside className="mx-auto mt-14 flex max-w-[40rem] flex-col items-start gap-4 rounded-[24px] bg-paper-2 p-6 sm:flex-row sm:items-center sm:justify-between md:mt-20">
          <div>
            <p className="text-[1.15rem] font-[650] tracking-[-0.025em]">{t.about.ask}</p>
            <p className="mt-0.5 text-[0.9rem] text-ink-soft">{t.about.askLead}</p>
          </div>
          <a href={whatsappLink("", store.whatsapp)} target="_blank" rel="noopener" className="pill pill-wa shrink-0">
            <WhatsAppIcon size={19} />
            {t.home.writeUs}
          </a>
        </aside>
      )}
    </article>
  );
}
