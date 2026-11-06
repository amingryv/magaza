/** Admin API client. Every write carries `x-admin: 1` (the Worker's CSRF check). */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function call<T = { ok: true }>(method: string, path: string, body?: unknown): Promise<T> {
  const raw = body instanceof Blob;
  let res: Response;
  try {
    res = await fetch(`/api/admin/${path}`, {
      method,
      credentials: "same-origin",
      headers: {
        "x-admin": "1",
        ...(body === undefined ? {} : { "content-type": raw ? body.type : "application/json" }),
      },
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "İnternet bağlantısını yoxlayın");
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(res.status, data.error || "Xəta baş verdi");
  return data;
}

export type Status = { admin: boolean; completed: boolean; logged_in: boolean; version: string };
export type Telegram = { bot: string | null; has_token: boolean; connected: boolean; enabled: boolean };
export type SettingsRes = { settings: Record<string, unknown>; telegram: Telegram; version: string };

/** Shrinks an image in the browser (canvas → WebP) before it is uploaded. */
export async function shrink(file: File, max: number, quality = 0.82): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * k);
  canvas.height = Math.round(bmp.height * k);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", quality));
  if (!blob) throw new ApiError(0, "Şəkli oxumaq olmadı");
  return blob;
}

export async function uploadImage(blob: Blob, folder: string): Promise<string> {
  const r = await call<{ url: string }>("POST", `upload?folder=${folder}`, blob);
  return r.url;
}
