import { HttpError, json, readJson } from "./http";
import { admin } from "./auth";
import { flag, int, parse, text, translations, uniqueSlug } from "./admin-catalog";

/* Static pages ("Haqqımızda", "Çatdırılma"...). Content is Markdown, rendered as React elements. */

type PageRow = { id: number; slug: string; title: string; content: string | null; is_active: number; show_in_menu: number; sort_order: number; translations: string | null; updated_at: string | null };

const toPage = (p: PageRow) => ({ ...p, content: p.content ?? "", is_active: !!p.is_active, show_in_menu: !!p.show_in_menu, translations: parse(p.translations, null) });

export const listPages = admin(async ({ env }) => {
  const { results } = await env.DB.prepare("SELECT * FROM pages ORDER BY sort_order, id").all<PageRow>();
  return json({ items: results.map(toPage) });
});

async function pageInput(env: Env, body: Record<string, unknown>, selfId: number | null) {
  const title = text(body.title, "Başlıq", 120, true);
  return {
    title,
    slug: await uniqueSlug(env, "pages", text(body.slug, "Link", 80) || title, selfId),
    content: text(body.content, "Mətn", 100_000),
    is_active: body.is_active === undefined ? 1 : flag(body.is_active),
    show_in_menu: flag(body.show_in_menu),
    translations: translations(body.translations),
  };
}

export const createPage = admin(async ({ env, req }) => {
  const p = await pageInput(env, await readJson(req, 500_000), null);
  const row = await env.DB.prepare(
    `INSERT INTO pages (slug, title, content, is_active, show_in_menu, sort_order, translations, updated_at)
     VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM pages), ?, ?) RETURNING id`,
  )
    .bind(p.slug, p.title, p.content, p.is_active, p.show_in_menu, p.translations, new Date().toISOString())
    .first<{ id: number }>();
  return json({ id: row!.id, slug: p.slug }, { status: 201 });
});

export const updatePage = admin(async ({ env, req, params }) => {
  const id = int(params.id, "id", 1, Number.MAX_SAFE_INTEGER)!;
  if (!(await env.DB.prepare("SELECT 1 FROM pages WHERE id = ?").bind(id).first())) throw new HttpError(404, "Səhifə tapılmadı");
  const p = await pageInput(env, await readJson(req, 500_000), id);
  await env.DB.prepare("UPDATE pages SET slug = ?, title = ?, content = ?, is_active = ?, show_in_menu = ?, translations = ?, updated_at = ? WHERE id = ?")
    .bind(p.slug, p.title, p.content, p.is_active, p.show_in_menu, p.translations, new Date().toISOString(), id)
    .run();
  return json({ ok: true, slug: p.slug });
});

export const deletePage = admin(async ({ env, params }) => {
  const id = int(params.id, "id", 1, Number.MAX_SAFE_INTEGER)!;
  await env.DB.prepare("DELETE FROM pages WHERE id = ?").bind(id).run();
  return json({ ok: true });
});
