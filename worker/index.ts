import { Router } from "./router";
import { error, json } from "./http";
import { serveImage } from "./images";
import { getBootstrap, getCategories, getPage, getProduct, getStore, listFilters, listProducts } from "./catalog";
import { injectShop, rootRedirect } from "./html";
import { createOrder } from "./orders";
import * as A from "./admin";

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
  .delete("/api/admin/upload/*key", A.deleteUpload);

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
} satisfies ExportedHandler<Env>;
