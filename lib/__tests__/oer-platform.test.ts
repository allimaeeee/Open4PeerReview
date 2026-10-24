import { describe, it, expect } from 'vitest'
import {
  isPrivateHostname,
  isValidOerUrl,
  getHostname,
  detectPlatform,
  detectPlatformFromHtml,
  platformLabel,
  basePlatform,
} from '../oer-platform'

describe('isValidOerUrl', () => {
  it.each([
    'https://open.maricopa.edu/book/chapter-1',
    'https://slcc.pressbooks.pub/intro/',
    'https://openstax.org/books/biology-2e/pages/1-introduction',
    'https://some-random-college.example/oer',
    'https://8.8.8.8/page',
  ])('accepts public https URL %s', url => {
    expect(isValidOerUrl(url)).toBe(true)
  })

  it.each([
    'http://open.maricopa.edu/book',
    'ftp://open.maricopa.edu/book',
    'javascript:alert(1)',
    'file:///etc/passwd',
    'not a url',
    '',
    'https://user:pass@open.maricopa.edu/',
    'https://localhost/',
    'https://app.localhost/',
    'https://127.0.0.1/',
    'https://10.0.0.5/',
    'https://172.16.0.1/',
    'https://172.31.255.255/',
    'https://192.168.1.1/',
    'https://169.254.169.254/latest/meta-data/',
    'https://100.64.0.1/',
    'https://0.0.0.0/',
    'https://[::1]/',
    'https://[fd00::1]/',
    'https://[fe80::1]/',
    'https://[::ffff:127.0.0.1]/',
    'https://intranet/',
    'https://printer.local/',
    'https://db.internal/',
  ])('rejects %s', url => {
    expect(isValidOerUrl(url)).toBe(false)
  })

  it('does not over-block public addresses adjacent to private ranges', () => {
    expect(isPrivateHostname('172.15.0.1')).toBe(false)
    expect(isPrivateHostname('172.32.0.1')).toBe(false)
    expect(isPrivateHostname('100.63.0.1')).toBe(false)
    expect(isPrivateHostname('100.128.0.1')).toBe(false)
  })
})

describe('getHostname', () => {
  it('lowercases the hostname and drops path/port', () => {
    expect(getHostname('https://Open.Maricopa.EDU:8443/book')).toBe('open.maricopa.edu')
  })
  it('returns null for garbage', () => {
    expect(getHostname('nope')).toBeNull()
  })
})

describe('detectPlatform (by hostname)', () => {
  it.each([
    ['https://openstax.org/books/x', 'OpenStax'],
    ['https://cnx.openstax.org/x', 'OpenStax'],
    ['https://slcc.pressbooks.pub/book', 'Pressbooks'],
    ['https://foo.pressbooks.com/book', 'Pressbooks'],
    ['https://oercommons.org/courses/x', 'OER Commons'],
    ['https://open.maricopa.edu/book', 'Other'],
    ['https://evilopenstax.org/', 'Other'],
    ['https://openstax.org.evil.com/', 'Other'],
    ['garbage', 'Other'],
  ])('%s -> %s', (url, expected) => {
    expect(detectPlatform(url)).toBe(expected)
  })
})

describe('detectPlatformFromHtml', () => {
  it('detects the Pressbooks generator meta tag', () => {
    expect(detectPlatformFromHtml('<head><meta name="generator" content="Pressbooks 6.4.0"></head>')).toBe('Pressbooks')
  })
  it('detects the generator tag with reversed attribute order', () => {
    expect(detectPlatformFromHtml('<meta content="Pressbooks 6" name="generator">')).toBe('Pressbooks')
  })
  it('detects Pressbooks theme assets', () => {
    expect(detectPlatformFromHtml('<link rel="stylesheet" href="/wp-content/themes/pressbooks-book/style.css">')).toBe('Pressbooks')
  })
  it('detects Pressbooks plugin assets', () => {
    expect(detectPlatformFromHtml('<script src="/wp-content/plugins/pressbooks/x.js"></script>')).toBe('Pressbooks')
  })
  it('does not flag a plain WordPress site', () => {
    expect(detectPlatformFromHtml('<meta name="generator" content="WordPress 6.5"><link href="/wp-content/themes/twentytwentyfour/s.css">')).toBeNull()
  })
  it('does not flag a page that merely mentions Pressbooks in body text', () => {
    expect(detectPlatformFromHtml('<html><body><p>We migrated away from Pressbooks.</p></body></html>')).toBeNull()
  })
  it('returns null for empty html', () => {
    expect(detectPlatformFromHtml('')).toBeNull()
  })
})

describe('platformLabel / basePlatform', () => {
  it('labels Pressbooks with the institution', () => {
    expect(platformLabel('Pressbooks', 'Maricopa Community Colleges')).toBe('Pressbooks (Maricopa Community Colleges)')
  })
  it('trims whitespace around the institution', () => {
    expect(platformLabel('Pressbooks', '  SLCC  ')).toBe('Pressbooks (SLCC)')
  })
  it.each([null, undefined, '', '   '])('falls back to plain Pressbooks when institution is %j', inst => {
    expect(platformLabel('Pressbooks', inst)).toBe('Pressbooks')
  })
  it('never decorates non-Pressbooks platforms', () => {
    expect(platformLabel('Other', 'SLCC')).toBe('Other')
    expect(platformLabel('OpenStax', 'SLCC')).toBe('OpenStax')
  })
  it('basePlatform round-trips the label', () => {
    expect(basePlatform(platformLabel('Pressbooks', 'Maricopa (West) College'))).toBe('Pressbooks')
    expect(basePlatform('OpenStax')).toBe('OpenStax')
    expect(basePlatform('Other')).toBe('Other')
  })
})
