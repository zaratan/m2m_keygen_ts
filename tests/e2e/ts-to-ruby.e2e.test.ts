import { describe, it, expect } from 'vitest';
import { generateFetcher } from '../../src/index';

/**
 * TS -> Ruby cross-language end-to-end test.
 *
 * This suite only runs when `M2M_RUBY_URL` points at a live Ruby Rack server
 * mounting the real `M2mKeygen::RackValidator` (see tests/e2e/ruby/config.ru).
 * It is skipped in the normal unit-test run and exercised by the dedicated
 * TS<->Ruby CI job, proving the TS client signs requests the deployed Ruby gem
 * accepts — over real HTTP, across languages.
 */
const RUBY_URL = process.env.M2M_RUBY_URL;
const SECRET = process.env.M2M_SECRET ?? 'e2e-test-secret';
const suite = RUBY_URL ? describe : describe.skip;

suite('TS client -> live Ruby RackValidator', () => {
  const fetcher = generateFetcher({
    fetcher: fetch,
    secret: SECRET,
    algorithm: 'sha256',
  });
  const url = `${RUBY_URL}/api/resource`;

  // Value shapes supported by BOTH the TS lib and the Ruby gem.
  const shapes: Record<string, Record<string, unknown>> = {
    scalars: { a: 1, b: 'x' },
    'array of strings': { e: ['a', 'b'] },
    'array of numbers': { e: [1, 2, 3] },
    'nested object': { f: { a: 1, b: 'two' } },
    'null value': { a: 1, g: null },
    unicode: { name: '你好世界' },
    'reserved url chars': { q: 'a b&c=d' },
  };

  for (const [name, params] of Object.entries(shapes)) {
    it(`GET accepts ${name}`, async () => {
      const res = (await fetcher(url, { ...params })) as Response;
      expect(res.status).toBe(200);
    });

    it(`POST accepts ${name}`, async () => {
      const res = (await fetcher(
        url,
        { ...params },
        { method: 'POST' }
      )) as Response;
      expect(res.status).toBe(200);
    });
  }

  // Booleans: a GET works because the query string coerces `true` -> "true",
  // which the Ruby gem accepts. A POST keeps the JSON boolean, which requires the
  // Ruby gem to support boolean param values (T::Boolean in ParamsValueType) — the
  // current gem raises internally and rejects it (401).
  describe('boolean values', () => {
    it('GET accepts a boolean', async () => {
      const res = (await fetcher(url, { flag: true })) as Response;
      expect(res.status).toBe(200);
    });

    // PENDING GEM FIX: the deployed Ruby gem does not yet accept boolean param
    // values in a JSON body. This test is intentionally left FAILING (red) in the
    // `e2e_ruby` CI job as a visible reminder; it will turn green on its own once
    // the gem gains boolean support (T::Boolean in ParamsValueType) is merged.
    it('POST accepts a boolean', async () => {
      const res = (await fetcher(
        url,
        { flag: true },
        { method: 'POST' }
      )) as Response;
      expect(res.status).toBe(200);
    });
  });

  describe('rejections', () => {
    it('rejects a request signed with the wrong secret', async () => {
      const bad = generateFetcher({
        fetcher: fetch,
        secret: 'wrong-secret',
        algorithm: 'sha256',
      });
      const res = (await bad(url, { a: 1 })) as Response;
      expect(res.status).toBe(401);
    });

    it('rejects a request with an expired expiry', async () => {
      const res = (await fetcher(url, {
        a: 1,
        expiry: Math.floor(Date.now() / 1000) - 1000,
      })) as Response;
      expect(res.status).toBe(401);
    });
  });
});
