const PLATFORM_RULES: { match: (hostname: string) => boolean; name: string }[] = [
  {
    name: 'OpenStax',
    match: h => h === 'openstax.org' || h.endsWith('.openstax.org'),
  },
  {
    name: 'Pressbooks',
    match: h =>
      h === 'pressbooks.com' ||
      h.endsWith('.pressbooks.com') ||
      h.endsWith('.pressbooks.pub'),
  },
  {
    name: 'OER Commons',
    match: h => h === 'oercommons.org' || h.endsWith('.oercommons.org'),
  },
  {
    name: 'LibreTexts',
    match: h => h === 'libretexts.org' || h.endsWith('.libretexts.org'),
  },
  {
    name: 'MERLOT',
    match: h => h === 'merlot.org' || h.endsWith('.merlot.org'),
  },
  {
    name: 'Open Textbook Library',
    match: h => h === 'open.umn.edu',
  },
  {
    name: 'Siyavula',
    match: h => h === 'siyavula.com' || h.endsWith('.siyavula.com'),
  },
]

export function detectPlatform(url: string): string {
  try {
    const { hostname } = new URL(url)
    return PLATFORM_RULES.find(r => r.match(hostname))?.name ?? 'Other'
  } catch {
    return 'Other'
  }
}

export function isKnownOerUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return PLATFORM_RULES.some(r => r.match(hostname))
  } catch {
    return false
  }
}
