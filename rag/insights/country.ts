// Renders the ISO 3166-1 alpha-2 code that Vercel's edge geo header gives us
// as a name a human can read without a lookup table. The codes are genuinely
// confusable in a report skimmed once a day — "IN" is India while Indonesia is
// "ID" — so every insights surface shows the name, never the bare code.
//
// Intl.DisplayNames ships with Node, so this costs no dependency and no data
// file. English is hardcoded: these reports are English regardless of the
// visitor's chat language.

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })

export function countryLabel(code: string | null | undefined): string {
  if (!code) return 'Unknown'
  try {
    // .of() returns the input unchanged for a well-formed but unassigned code
    // (e.g. 'ZZ') and throws RangeError for a structurally invalid one.
    return regionNames.of(code.toUpperCase()) ?? code
  } catch {
    return code
  }
}
