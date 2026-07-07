// Server-only. Extracts the Glossary of Terms section (term -> definition) from
// the static rubric-md/*.md files — ported from oer-hub's rubricGlossaryLookup.ts,
// extended to keep the definition text (not just the term name), since prompts
// need to cherry-pick definitions for terms appearing in the active criterion.

import fs from 'fs'
import path from 'path'
import type { RubricSlug } from './rubricNameMap'

const RUBRIC_DATA_DIR = path.join(process.cwd(), 'features/ai-chat/rubric-data')

const _rawCache: Partial<Record<RubricSlug, string>> = {}

function readRubricMd(id: RubricSlug): string {
  if (!_rawCache[id]) {
    _rawCache[id] = fs.readFileSync(path.join(RUBRIC_DATA_DIR, `${id}.md`), 'utf-8')
  }
  return _rawCache[id]!
}

function parseGlossary(md: string): Map<string, string> {
  const headingEnd = md.indexOf('**Glossary of Terms**')
  if (headingEnd === -1) return new Map()
  const sectionStart = headingEnd + '**Glossary of Terms**'.length
  const refIdx = md.indexOf('**References', sectionStart)
  const glossary = refIdx !== -1 ? md.slice(sectionStart, refIdx) : md.slice(sectionStart)

  // Term entries are lines starting with "**Term**:" or "**Term:**" at the
  // start of a line — some rubric files separate entries with blank lines,
  // others just a single newline, so split on the term markers themselves
  // rather than assuming paragraph breaks. Sub-bullets under compound terms
  // (e.g. "Creative Commons (CC) Attribution:") are kept as part of that
  // term's definition text rather than parsed as separate entries.
  const termHeadingRe = /^\*\*([^*:]+?)\*\*:?/gm
  const matches = [...glossary.matchAll(termHeadingRe)]
  const entries = new Map<string, string>()

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const term = match[1].trim().toLowerCase()
    if (!term) continue
    const defStart = match.index! + match[0].length
    const defEnd = i + 1 < matches.length ? matches[i + 1].index! : glossary.length
    const definition = glossary.slice(defStart, defEnd).trim()
    if (!definition) continue
    entries.set(term, definition)
  }
  return entries
}

const _cache: Partial<Record<RubricSlug, Map<string, string>>> = {}

function getGlossary(id: RubricSlug): Map<string, string> {
  if (!_cache[id]) _cache[id] = parseGlossary(readRubricMd(id))
  return _cache[id]!
}

/** Lowercase glossary term names for the given rubric. */
export function getRubricTermSet(id: RubricSlug): Set<string> {
  return new Set(getGlossary(id).keys())
}

/**
 * Definitions for whichever glossary terms literally appear in `text`
 * (case-insensitive substring match) — used to cherry-pick only the terms
 * relevant to the active criterion rather than injecting the full glossary.
 */
export function getGlossaryTermsInText(id: RubricSlug, text: string): Record<string, string> {
  const lowerText = text.toLowerCase()
  const result: Record<string, string> = {}
  for (const [term, definition] of getGlossary(id)) {
    if (lowerText.includes(term)) result[term] = definition
  }
  return result
}

/** Full raw markdown text for the given rubric — used as system prompt context when needed. */
export function getRubricFullText(id: RubricSlug): string {
  return readRubricMd(id)
}
