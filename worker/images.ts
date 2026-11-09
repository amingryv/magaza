import type { Ctx } from "./router";
import { error } from "./http";

export const IMAGE_FOLDERS = new Set(["products", "brand", "categories", "banners", "demo"]);

/** GET /images/<key> — serves an R2 object; keys never change, so cache for a year. */
export async function serveImage({ req, env, params }: Ctx): Promise<Response> {
  const key = params.key;
  // picture folders only: `backups/` in the same bucket holds customer data
  if (!key || key.includes("..") || !IMAGE_FOLDERS.has(key.split("/")[0])) return error(404, "Şəkil tapılmadı");

  const obj = await env.IMAGES.get(key, { onlyIf: req.headers, range: req.headers });
  if (!obj) return error(404, "Şəkil tapılmadı");

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");

  // onlyIf matched an If-None-Match / If-Modified-Since: no body was read.
  if (!("body" in obj)) return new Response(null, { status: 304, headers });
  return new Response(req.method === "HEAD" ? null : obj.body, { headers });
}
