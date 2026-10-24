import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const lookupMock = vi.fn()
vi.mock('node:dns/promises', () => ({ lookup: (...a: unknown[]) => lookupMock(...a) }))

import { safeFetch } from '../url-safety'

const fetchMock = vi.fn()

function redirect(to: string, status = 302) {
  return new Response(null, { status, headers: { location: to } })
}
function ok(body = 'ok') {
  return new Response(body, { status: 200 })
}

beforeEach(() => {
  lookupMock.mockReset()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  lookupMock.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('safeFetch', () => {
  it('fetches a public host with manual redirect handling', async () => {
    fetchMock.mockResolvedValueOnce(ok('hello'))
    const res = await safeFetch('https://open.maricopa.edu/book')
    expect(await res.text()).toBe('hello')
    expect(fetchMock).toHaveBeenCalledWith('https://open.maricopa.edu/book', expect.objectContaining({ redirect: 'manual' }))
  })

  it('passes request headers through', async () => {
    fetchMock.mockResolvedValueOnce(ok())
    await safeFetch('https://open.maricopa.edu/', { headers: { 'User-Agent': 'x' } })
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ 'User-Agent': 'x' })
  })

  it('rejects non-https and private literal URLs without fetching', async () => {
    await expect(safeFetch('http://open.maricopa.edu/')).rejects.toThrow(/public https/)
    await expect(safeFetch('https://127.0.0.1/')).rejects.toThrow(/public https/)
    await expect(safeFetch('https://169.254.169.254/')).rejects.toThrow(/public https/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a public-looking hostname that resolves to a private address', async () => {
    lookupMock.mockResolvedValueOnce([{ address: '10.0.0.7', family: 4 }])
    await expect(safeFetch('https://sneaky.example.com/')).rejects.toThrow(/non-public/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects when ANY resolved address is private', async () => {
    lookupMock.mockResolvedValueOnce([
      { address: '93.184.216.34', family: 4 },
      { address: '192.168.0.9', family: 4 },
    ])
    await expect(safeFetch('https://mixed.example.com/')).rejects.toThrow(/non-public/)
  })

  it('rejects when DNS returns no records', async () => {
    lookupMock.mockResolvedValueOnce([])
    await expect(safeFetch('https://empty.example.com/')).rejects.toThrow(/non-public/)
  })

  describe('redirects', () => {
    it('follows a redirect chain to the final public page', async () => {
      fetchMock
        .mockResolvedValueOnce(redirect('https://open.maricopa.edu/book/'))
        .mockResolvedValueOnce(redirect('/book/chapter-1', 301))
        .mockResolvedValueOnce(ok('final'))
      const res = await safeFetch('https://maricopa.pressbooks.pub/book')
      expect(await res.text()).toBe('final')
      expect(fetchMock.mock.calls.map(c => c[0])).toEqual([
        'https://maricopa.pressbooks.pub/book',
        'https://open.maricopa.edu/book/',
        'https://open.maricopa.edu/book/chapter-1', // relative Location resolved against the current hop
      ])
    })

    it.each([301, 302, 303, 307, 308])('follows a %i redirect', async status => {
      fetchMock.mockResolvedValueOnce(redirect('https://b.example.com/', status)).mockResolvedValueOnce(ok('b'))
      expect(await (await safeFetch('https://a.example.com/')).text()).toBe('b')
    })

    it('blocks a redirect to a private IP literal', async () => {
      fetchMock.mockResolvedValueOnce(redirect('https://169.254.169.254/latest/meta-data/'))
      await expect(safeFetch('https://open.maricopa.edu/')).rejects.toThrow(/public https/)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('blocks a redirect to localhost', async () => {
      fetchMock.mockResolvedValueOnce(redirect('https://localhost:3000/api'))
      await expect(safeFetch('https://open.maricopa.edu/')).rejects.toThrow(/public https/)
    })

    it('blocks a redirect downgrade to http', async () => {
      fetchMock.mockResolvedValueOnce(redirect('http://open.maricopa.edu/'))
      await expect(safeFetch('https://open.maricopa.edu/')).rejects.toThrow(/public https/)
    })

    it('blocks a redirect to a hostname that resolves privately', async () => {
      lookupMock
        .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }]) // first hop OK
        .mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }]) // second hop rebinding to loopback
      fetchMock.mockResolvedValueOnce(redirect('https://rebind.example.com/'))
      await expect(safeFetch('https://open.maricopa.edu/')).rejects.toThrow(/non-public/)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('stops after 5 redirects', async () => {
      fetchMock.mockImplementation(async () => redirect('https://loop.example.com/'))
      await expect(safeFetch('https://loop.example.com/')).rejects.toThrow(/Too many redirects/)
      expect(fetchMock).toHaveBeenCalledTimes(6) // initial + 5 hops
    })

    it('returns a 3xx with no Location header as-is', async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 302 }))
      const res = await safeFetch('https://open.maricopa.edu/')
      expect(res.status).toBe(302)
    })

    it('returns non-2xx final responses to the caller', async () => {
      fetchMock.mockResolvedValueOnce(new Response('nope', { status: 404 }))
      expect((await safeFetch('https://open.maricopa.edu/missing')).status).toBe(404)
    })
  })
})
