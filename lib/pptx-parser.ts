// Client-only — uses JSZip (dynamic import) and DOMParser (browser API).
// All getElementsByTagNameNS calls use '*' (wildcard namespace) because PPTX generators
// (Google Slides, LibreOffice, Keynote) don't consistently resolve namespace prefix
// URIs when queried with the explicit OOXML namespace URIs.

export interface PptxSlide {
  index: number  // 1-based
  title: string
  paragraphs: string[]
}

// Use '*' wildcard namespace for all element lookups — PPTX generators (Google Slides,
// LibreOffice, Keynote exports) don't always resolve namespace prefixes consistently
// when queried via getElementsByTagNameNS with an explicit URI. Wildcard works universally.

function byTag(parent: Document | Element, localName: string): HTMLCollectionOf<Element> {
  return parent.getElementsByTagNameNS('*', localName)
}

function parseSlideXml(xml: string): { title: string; paragraphs: string[] } {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')

  let title = ''
  const paragraphs: string[] = []

  const shapes = byTag(doc, 'sp')
  for (const shape of shapes) {
    const ph = byTag(shape, 'ph')[0]
    const phType = ph?.getAttribute('type') ?? ''
    // idx='0' (or absent) with no type is PowerPoint's default title slot on body slides
    const phIdx = ph?.getAttribute('idx') ?? null
    const isTitle =
      phType === 'title' ||
      phType === 'ctrTitle' ||
      phType === 'subTitle' ||
      (ph !== undefined && phType === '' && (phIdx === '0' || phIdx === null))

    const shapeParagraphs: string[] = []
    for (const paraEl of byTag(shape, 'p')) {
      const text = Array.from(byTag(paraEl, 't'))
        .map(t => t.textContent ?? '')
        .join('')
        .trim()
      if (text) shapeParagraphs.push(text)
    }

    if (isTitle && !title && shapeParagraphs.length > 0) {
      title = shapeParagraphs[0]
      paragraphs.push(...shapeParagraphs.slice(1))
    } else {
      paragraphs.push(...shapeParagraphs)
    }
  }

  return { title, paragraphs }
}

async function getSlidePathsInOrder(zip: import('jszip')): Promise<string[]> {
  const presFile = zip.file('ppt/presentation.xml')
  const relFile = zip.file('ppt/_rels/presentation.xml.rels')
  if (!presFile || !relFile) return []

  const parser = new DOMParser()
  const [presXml, relXml] = await Promise.all([
    presFile.async('string'),
    relFile.async('string'),
  ])

  const presDoc = parser.parseFromString(presXml, 'application/xml')
  const relDoc = parser.parseFromString(relXml, 'application/xml')

  // Build rId → target map (wildcard namespace for compat)
  const rIdToTarget: Record<string, string> = {}
  for (const rel of byTag(relDoc, 'Relationship')) {
    const id = rel.getAttribute('Id')
    const target = rel.getAttribute('Target')
    if (id && target) rIdToTarget[id] = target
  }

  const paths: string[] = []
  for (const sldId of byTag(presDoc, 'sldId')) {
    // r:id attribute — try namespace-aware first, fall back to prefixed form
    const rId =
      sldId.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ??
      sldId.getAttribute('r:id')
    if (!rId) continue
    const target = rIdToTarget[rId]
    if (!target) continue
    // Target is relative to ppt/ directory (e.g. 'slides/slide1.xml')
    const path = target.startsWith('/') ? target.slice(1) : `ppt/${target}`
    paths.push(path)
  }

  return paths
}

export async function parsePptxFromUrl(url: string): Promise<PptxSlide[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch PPTX (${res.status})`)
  const blob = await res.blob()
  return parsePptxFromBlob(blob)
}

export async function parsePptxFromBlob(blob: Blob): Promise<PptxSlide[]> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(blob)

  let slidePaths = await getSlidePathsInOrder(zip)

  // Fallback: enumerate files numerically
  if (slidePaths.length === 0) {
    slidePaths = Object.keys(zip.files)
      .filter(f => /^ppt\/slides\/slide\d+\.xml$/.test(f))
      .sort((a, b) => {
        const n = (s: string) => parseInt(s.match(/slide(\d+)/)?.[1] ?? '0')
        return n(a) - n(b)
      })
  }

  const slides: PptxSlide[] = []
  for (let i = 0; i < slidePaths.length; i++) {
    const file = zip.file(slidePaths[i])
    if (!file) continue
    const xml = await file.async('string')
    const { title, paragraphs } = parseSlideXml(xml)
    slides.push({
      index: i + 1,
      title: title || `Slide ${i + 1}`,
      paragraphs,
    })
  }

  return slides
}
