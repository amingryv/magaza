import { HttpError, error } from "./http";

export type Ctx = {
  req: Request;
  env: Env;
  exec: ExecutionContext;
  url: URL;
  params: Record<string, string>;
};

type Handler = (c: Ctx) => Response | Promise<Response>;
type Route = { method: string; parts: string[]; handler: Handler };

/**
 * Minimal path router. Patterns use `:name` for one segment and a trailing
 * `*name` for the rest of the path (e.g. R2 keys with slashes).
 */
export class Router {
  private routes: Route[] = [];

  on(method: string, pattern: string, handler: Handler): this {
    this.routes.push({ method, parts: split(pattern), handler });
    return this;
  }
  get(p: string, h: Handler) {
    return this.on("GET", p, h);
  }
  post(p: string, h: Handler) {
    return this.on("POST", p, h);
  }
  put(p: string, h: Handler) {
    return this.on("PUT", p, h);
  }
  patch(p: string, h: Handler) {
    return this.on("PATCH", p, h);
  }
  delete(p: string, h: Handler) {
    return this.on("DELETE", p, h);
  }

  async handle(req: Request, env: Env, exec: ExecutionContext): Promise<Response | null> {
    const url = new URL(req.url);
    const path = split(url.pathname);
    let pathMatched = false;

    for (const r of this.routes) {
      const params = match(r.parts, path);
      if (!params) continue;
      pathMatched = true;
      const method = req.method === "HEAD" ? "GET" : req.method;
      if (r.method !== method) continue;
      try {
        return await r.handler({ req, env, exec, url, params });
      } catch (e) {
        if (e instanceof HttpError) return error(e.status, e.message);
        console.error(e);
        return error(500, "Daxili xəta");
      }
    }
    return pathMatched ? error(405, "Metod dəstəklənmir") : null;
  }
}

function split(p: string): string[] {
  return p.split("/").filter(Boolean);
}

function match(pattern: string[], path: string[]): Record<string, string> | null {
  const params: Record<string, string> = {};
  for (let i = 0; i < pattern.length; i++) {
    const seg = pattern[i];
    if (seg.startsWith("*")) {
      const rest = path.slice(i);
      if (!rest.length) return null;
      params[seg.slice(1)] = rest.map(decodeURIComponent).join("/");
      return params;
    }
    if (i >= path.length) return null;
    if (seg.startsWith(":")) params[seg.slice(1)] = decodeURIComponent(path[i]);
    else if (seg !== path[i]) return null;
  }
  return pattern.length === path.length ? params : null;
}
