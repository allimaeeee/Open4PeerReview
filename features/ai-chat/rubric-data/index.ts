// Server-only. Parses the static rubric-md/*.md files (operational definition,
// framing language, threshold paragraph, best practices) at request time via
// fs.readFileSync — ported from oer-hub's rubric-md/index.ts, with the Vite
// `?raw` import swapped for a Node filesystem read.

import fs from 'fs'
import path from 'path'
import type { RubricSlug } from './rubricNameMap'
import { RUBRIC_DISPLAY_NAMES } from './rubricNameMap'

export interface RubricMdSections {
  id: RubricSlug
  name: string
  operationalDefinition: string
  framingLanguage: string
  thresholdParagraph: string
  bestPractices: string[]
}

const RUBRIC_DATA_DIR = path.join(process.cwd(), 'features/ai-chat/rubric-data')

const _rawCache: Partial<Record<RubricSlug, string>> = {}

function readRubricMd(id: RubricSlug): string {
  if (!_rawCache[id]) {
    _rawCache[id] = fs.readFileSync(path.join(RUBRIC_DATA_DIR, `${id}.md`), 'utf-8')
  }
  return _rawCache[id]!
}

function sliceSection(raw: string, startMarker: string, endMarker: string | null): string {
  const start = raw.indexOf(startMarker)
  if (start === -1) return ''
  const afterHeading = raw.indexOf('\n', start)
  const end = endMarker ? raw.indexOf(endMarker, start) : raw.length
  if (afterHeading === -1 || end === -1) return ''
  return raw.slice(afterHeading, end).trim()
}

function extractThresholdParagraph(framingLanguage: string): string {
  const start = framingLanguage.indexOf('***Threshold for achieving')
  if (start === -1) return ''
  // The sub-header itself is wrapped in its own "***...***" italics — skip past
  // that closing marker before looking for the *next* sub-header's opening "***".
  const headingCloseIdx = framingLanguage.indexOf('***', start + 3)
  if (headingCloseIdx === -1) return framingLanguage.slice(start).trim()
  const nextHeaderIdx = framingLanguage.indexOf('***', headingCloseIdx + 3)
  const end = nextHeaderIdx === -1 ? framingLanguage.length : nextHeaderIdx
  return framingLanguage.slice(start, end).trim()
}

function extractBestPractices(framingLanguage: string): string[] {
  const start = framingLanguage.indexOf('Best practices for using the rubric.')
  if (start === -1) return []
  const section = framingLanguage.slice(start)
  return section
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('*') && !l.startsWith('***'))
    .map(l => l.replace(/^\*\s*/, '').replace(/\*\*/g, '').trim())
    .filter(Boolean)
}

const _cache: Partial<Record<RubricSlug, RubricMdSections>> = {}

export function getRubricMdSections(id: RubricSlug): RubricMdSections {
  if (_cache[id]) return _cache[id]!

  const raw = readRubricMd(id)
  const operationalDefinition = sliceSection(raw, '**Operational Definition', '**Framing Language**')
  const framingLanguage = sliceSection(raw, '**Framing Language**', '**Glossary of Terms**')
  const thresholdParagraph = extractThresholdParagraph(framingLanguage)
  const bestPractices = extractBestPractices(framingLanguage)

  const sections: RubricMdSections = {
    id,
    name: RUBRIC_DISPLAY_NAMES[id],
    operationalDefinition,
    framingLanguage,
    thresholdParagraph,
    bestPractices,
  }
  _cache[id] = sections
  return sections
}
