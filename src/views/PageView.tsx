"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useSite } from "@/lib/site";
import { usePage } from "@/lib/api";
import { Markdown } from "@/components/Markdown";

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
    <article className="wrap pb-14 pt-6 md:pt-12">
      <h1 className="page-title">{title}</h1>
      <div className="prose-shop mt-6 max-w-[42rem]">
        <Markdown text={content} />
      </div>
    </article>
  );
}
