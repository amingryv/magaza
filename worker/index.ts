import { Router } from "./router";
import { error, json } from "./http";
import { serveImage } from "./images";
import { getBootstrap, getCategories, getPage, getProduct, getStore, listFilters, listProducts } from "./catalog";
import { injectShop, rootRedirect } from "./html";
import { createOrder } from "./orders";
import { robots, sitemap } from "./seo";
import * as A from "./admin";
import * as C from "./admin-catalog";
import * as O from "./admin-orders";
import * as P from "./admin-pages";
import * as Bk from "./admin-backup";
import * as Csv from "./admin-csv";

const router = new Router()
  // Health check: confirms the Worker runs and the migrations reached D1.
  .get("/api/health", async ({ env }) => {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'app.schema'").first<{ value: string }>();
    return json({ ok: true, schema: row ? Number(row.value) : null });
  })
  .get("/api/bootstrap", getBootstrap)
  .get("/api/store", getStore)
  .get("/api/categories", getCategories)
  .get("/api/products", listProducts)
  .get("/api/products/:slug", getProduct)
  .get("/api/attributes/filters", listFilters)
  .get("/api/pages/:slug", getPage)
  .post("/api/orders", createOrder)
  .get("/images/*key", serveImage)
  .get("/robots.txt", robots)
  .get("/sitemap.xml", sitemap)
  // admin
  .get("/api/admin/setup-status", A.setupStatus)
  .post("/api/admin/setup", A.setup)
  .post("/api/admin/login", A.login)
  .post("/api/admin/logout", A.logout)
  .post("/api/admin/password", A.changePassword)
  .get("/api/admin/settings", A.getSettings)
  .put("/api/admin/settings", A.putSettings)
  .post("/api/admin/sector", A.applySector)
  .post("/api/admin/telegram/token", A.telegramToken)
  .post("/api/admin/telegram/connect", A.telegramConnect)
  .post("/api/admin/telegram/test", A.telegramTest)
  .post("/api/admin/upload", A.upload)
  .delete("/api/admin/upload/*key", A.deleteUpload)
  .get("/api/admin/categories", C.listCategories)
  .post("/api/admin/categories", C.createCategory)
  .post("/api/admin/categories/reorder", C.reorder("categories"))
  .put("/api/admin/categories/:id", C.updateCategory)
  .delete("/api/admin/categories/:id", C.deleteCategory)
  .get("/api/admin/attributes", C.listAttributes)
  .post("/api/admin/attributes", C.createAttribute)
  .post("/api/admin/attributes/reorder", C.reorder("attributes"))
  .put("/api/admin/attributes/:id", C.updateAttribute)
  .delete("/api/admin/attributes/:id", C.deleteAttribute)
  .get("/api/admin/products", C.listAdminProducts)
  .post("/api/admin/products", C.createProduct)
  .post("/api/admin/products/bulk", C.bulkProducts)
  .get("/api/admin/products/:id", C.getAdminProduct)
  .put("/api/admin/products/:id", C.updateProduct)
  .delete("/api/admin/products/:id", C.deleteProduct)
  .post("/api/admin/products/:id/copy", C.copyProduct)
  .get("/api/admin/stats", O.stats)
  .get("/api/admin/orders", O.listOrders)
  .get("/api/admin/orders/:id", O.getOrder)
  .patch("/api/admin/orders/:id", O.patchOrder)
  .post("/api/admin/orders/:id/notify", O.notifyOrder)
  .get("/api/admin/pages", P.listPages)
  .post("/api/admin/pages", P.createPage)
  .post("/api/admin/pages/reorder", C.reorder("pages"))
  .put("/api/admin/pages/:id", P.updatePage)
  .delete("/api/admin/pages/:id", P.deletePage)
  .get("/api/admin/export", Bk.exportBackup)
  .post("/api/admin/import", Bk.importBackup)
  .get("/api/admin/backups", Bk.listAutoBackups)
  .get("/api/admin/backups/:name", Bk.getAutoBackup)
  .get("/api/admin/export/products", Csv.exportProducts)
  .post("/api/admin/import/products", Csv.importProducts);

export default {
  async fetch(req, env, exec): Promise<Response> {
    const res = await router.handle(req, env, exec);
    if (res) return res;

    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) return error(404, "Tapılmadı");
    if (url.pathname === "/" && (req.method === "GET" || req.method === "HEAD")) return rootRedirect(env, req);

    // Next's prefetch files carry "$" in their names (`__next.$d$lang...txt`).
    // The asset server stores them percent-encoded and would answer the raw
    // name with a 307; ask for the stored name directly instead.
    let assetReq = req;
    if (url.pathname.includes("$")) {
      url.pathname = url.pathname.replaceAll("$", "%24");
      assetReq = new Request(url, req);
    }

    const asset = await env.ASSETS.fetch(assetReq);
    if (!(asset.headers.get("content-type") ?? "").startsWith("text/html")) return asset;
    try {
      return await injectShop(env, req, asset);
    } catch (e) {
      // a database hiccup must not take the shop down: serve the plain page
      console.error("injectShop", e);
      return asset;
    }
  },

  // wrangler.jsonc "triggers": weekly backup to R2 + housekeeping
  async scheduled(_ctrl, env, ctx) {
    const now = new Date();
    ctx.waitUntil(
      env.DB.batch([
        env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(now.toISOString()),
        env.DB.prepare("DELETE FROM rate_limits WHERE window_end < ?").bind(Math.floor(now.getTime() / 1000)),
      ]).catch((e) => console.error("cleanup", e)),
    );
    ctx.waitUntil(Bk.writeAutoBackup(env).catch((e) => console.error("auto backup", e)));
  },
} satisfies ExportedHandler<Env>;
