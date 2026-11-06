import { Fragment, type ReactNode } from "react";

/* ══ A small, safe Markdown ═════════════════════════════════
   Owner pages are written in a plain text box. This understands the few
   things people actually type: # headings, - lists, 1. lists, blank-line
   paragraphs, **bold**, *italic* and [links](https://...). It builds React
   elements, never HTML, so nothing typed can run as code; links accept
   only http(s), mailto, tel and site paths. */

const SAFE_HREF = /^(https?:\/\/|mailto:|tel:|\/)/i;

function inline(text: string, key = 0): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = key;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      const href = m[2];
      out.push(
        SAFE_HREF.test(href) ? (
          <a key={i++} href={href} target={href.startsWith("/") ? undefined : "_blank"} rel="noopener nofollow" className="underline decoration-ink-line-2 underline-offset-2 hover:decoration-ink">
            {m[1]}
          </a>
        ) : (
          m[1]
        ),
      );
    } else if (m[3] !== undefined) out.push(<strong key={i++}>{m[3]}</strong>);
    else out.push(<em key={i++}>{m[4]}</em>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const blocks = text.replace(/\r\n?/g, "\n").split(/\n\s*\n/);
  return (
    <>
      {blocks.map((block, b) => {
        const lines = block.split("\n").filter((l) => l.trim());
        if (!lines.length) return null;
        const h = /^(#{1,3})\s+(.*)$/.exec(lines[0]);
        if (h && lines.length === 1) {
          const Tag = (["h2", "h3", "h4"] as const)[h[1].length - 1];
          return <Tag key={b}>{inline(h[2])}</Tag>;
        }
        if (lines.every((l) => /^\s*[-*•]\s+/.test(l)))
          return (
            <ul key={b}>
              {lines.map((l, i) => (
                <li key={i}>{inline(l.replace(/^\s*[-*•]\s+/, ""))}</li>
              ))}
            </ul>
          );
        if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l)))
          return (
            <ol key={b}>
              {lines.map((l, i) => (
                <li key={i}>{inline(l.replace(/^\s*\d+[.)]\s+/, ""))}</li>
              ))}
            </ol>
          );
        return (
          <p key={b}>
            {lines.map((l, i) => (
              <Fragment key={i}>
                {i > 0 && <br />}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}
