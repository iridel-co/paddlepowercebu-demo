/**
 * Renders a JSON-LD block into the document.
 *
 * Server-rendered, so the structured data is in the HTML Google receives
 * rather than something it has to run JavaScript to discover.
 *
 * Lives here rather than in `src/components/` because that directory is the
 * shared template layer and isn't touched per client.
 */

type JsonLdProps = {
  /** Plain object; serialised as-is. */
  data: unknown
  /** Distinguishes the blocks when several are on one page. */
  id: string
}

/**
 * Escapes the characters that could otherwise close the surrounding script
 * element early. FAQ copy is authored in-repo today, but this is the kind of
 * thing that stops being true the moment content moves to a CMS.
 */
function serialize(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
}

export function JsonLd({ data, id }: JsonLdProps) {
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serialize(data) }}
    />
  )
}
