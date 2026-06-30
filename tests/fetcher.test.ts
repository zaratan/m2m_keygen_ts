import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { sign, validate } from '../src/signature';
import { generateFetcher } from '../src/fetcher';
import {
  parseQueryToParams,
  translateParamsToQuery,
} from '../src/helpers/paramsEncoder';
import { mockDate } from './support/mockDate';

// Create a mock fetcher
const mockFetch = vi.fn((_url: any, _init: any) => ({
  result: 'ok',
}));

describe('generateFetcher', () => {
  const frozenTime = new Date();
  const timestamp = Math.round(frozenTime.getTime() / 1000);

  let unfreezeTime: () => void;

  beforeAll(() => {
    unfreezeTime = mockDate(frozenTime);
  });

  afterAll(() => {
    unfreezeTime();
  });

  const fetcher = generateFetcher({
    fetcher: mockFetch,
    secret: 'secret',
  });

  it('generates a fetcher', () => {
    fetcher('http://example.com/oki', { a: 1, b: 2 });

    expect(mockFetch).toHaveBeenCalled();
    expect((mockFetch.mock.lastCall || [])[0]).toEqual(
      `http://example.com/oki?a=1&b=2&expiry=${timestamp + 90}`
    );
    const finalParams = { a: 1, b: 2, expiry: timestamp + 90 };
    expect((mockFetch.mock.lastCall || [])[1].headers['X-Signature']).toEqual(
      sign({
        secret: 'secret',
        params: parseQueryToParams(translateParamsToQuery(finalParams)),
        verb: 'GET',
        path: '/oki',
      })
    );
    expect((mockFetch.mock.lastCall || [])[1].headers['Accept']).toEqual(
      'application/json'
    );
  });

  it('keeps previous expiry', () => {
    fetcher('http://example.com/oki', { a: 1, b: 2, expiry: timestamp + 100 });

    expect(mockFetch).toHaveBeenCalled();
    expect((mockFetch.mock.lastCall || [])[0]).toEqual(
      `http://example.com/oki?a=1&b=2&expiry=${timestamp + 100}`
    );
    const finalParams = { a: 1, b: 2, expiry: timestamp + 100 };
    expect((mockFetch.mock.lastCall || [])[1].headers['X-Signature']).toEqual(
      sign({
        secret: 'secret',
        params: parseQueryToParams(translateParamsToQuery(finalParams)),
        verb: 'GET',
        path: '/oki',
      })
    );
  });

  it('keeps existing headers', () => {
    fetcher(
      'http://example.com/oki',
      { a: 1, b: 2 },
      { headers: { Accept: 'text/plain', Pokemon: 'Red' } }
    );

    expect(mockFetch).toHaveBeenCalled();
    expect((mockFetch.mock.lastCall || [])[1].headers['Accept']).toEqual(
      'text/plain'
    );
    expect((mockFetch.mock.lastCall || [])[1].headers['Pokemon']).toEqual(
      'Red'
    );
  });

  describe('when the method is specified', () => {
    it('uses the method in signature', () => {
      fetcher('http://example.com/oki', { a: 1, b: 2 }, { method: 'post' });

      expect(mockFetch).toHaveBeenCalled();
      expect((mockFetch.mock.lastCall || [])[0]).toEqual(
        `http://example.com/oki`
      );
      expect((mockFetch.mock.lastCall || [])[1].headers['X-Signature']).toEqual(
        sign({
          secret: 'secret',
          params: { a: 1, b: 2, expiry: timestamp + 90 },
          verb: 'POST',
          path: '/oki',
        })
      );
    });

    it('keeps the method in the fetch options', () => {
      fetcher('http://example.com/oki', { a: 1, b: 2 }, { method: 'post' });

      expect(mockFetch).toHaveBeenCalled();
      expect((mockFetch.mock.lastCall || [])[0]).toEqual(
        `http://example.com/oki`
      );
      expect((mockFetch.mock.lastCall || [])[1].method).toEqual('post');
    });

    it('JSON encodes the params in the body', () => {
      fetcher('http://example.com/oki', { a: 1, b: 2 }, { method: 'post' });

      expect(mockFetch).toHaveBeenCalled();
      expect((mockFetch.mock.lastCall || [])[0]).toEqual(
        `http://example.com/oki`
      );
      expect((mockFetch.mock.lastCall || [])[1].body).toEqual(
        JSON.stringify({ a: 1, b: 2, expiry: timestamp + 90 })
      );
    });

    it('tells the app the content is JSON', () => {
      fetcher('http://example.com/oki', { a: 1, b: 2 }, { method: 'post' });

      expect(mockFetch).toHaveBeenCalled();
      expect((mockFetch.mock.lastCall || [])[0]).toEqual(
        `http://example.com/oki`
      );
      expect(
        (mockFetch.mock.lastCall || [])[1].headers['Content-Type']
      ).toEqual('application/json');
    });
  });

  describe('GET round-trip validation', () => {
    it('validates signature for request with array of numbers', () => {
      fetcher('http://example.com/oki', { e: [1, 2, 3] });

      const calledUrl: string = (mockFetch.mock.lastCall || [])[0];
      const signature: string = (mockFetch.mock.lastCall || [])[1].headers[
        'X-Signature'
      ];
      const queryStart = calledUrl.indexOf('?');
      const extractedQuery =
        queryStart !== -1 ? calledUrl.slice(queryStart) : '';

      expect(
        validate({
          secret: 'secret',
          params: parseQueryToParams(extractedQuery),
          verb: 'GET',
          path: '/oki',
          signature,
        })
      ).toBe(true);
    });

    it('validates signature for request with nested object', () => {
      fetcher('http://example.com/oki', { f: { a: 1, b: true } });

      const calledUrl: string = (mockFetch.mock.lastCall || [])[0];
      const signature: string = (mockFetch.mock.lastCall || [])[1].headers[
        'X-Signature'
      ];
      const queryStart = calledUrl.indexOf('?');
      const extractedQuery =
        queryStart !== -1 ? calledUrl.slice(queryStart) : '';

      expect(
        validate({
          secret: 'secret',
          params: parseQueryToParams(extractedQuery),
          verb: 'GET',
          path: '/oki',
          signature,
        })
      ).toBe(true);
    });

    it('validates signature when null param is omitted', () => {
      fetcher('http://example.com/oki', { a: 1, g: null });

      const calledUrl: string = (mockFetch.mock.lastCall || [])[0];
      const signature: string = (mockFetch.mock.lastCall || [])[1].headers[
        'X-Signature'
      ];
      const queryStart = calledUrl.indexOf('?');
      const extractedQuery =
        queryStart !== -1 ? calledUrl.slice(queryStart) : '';

      expect(
        validate({
          secret: 'secret',
          params: parseQueryToParams(extractedQuery),
          verb: 'GET',
          path: '/oki',
          signature,
        })
      ).toBe(true);
    });
  });

  describe('Phase 3 hardening', () => {
    describe('immutability', () => {
      it('does not mutate the params object passed by the caller', () => {
        const originalParams = { a: 1 };
        fetcher('http://example.com/oki', originalParams);

        expect(originalParams).not.toHaveProperty('expiry');
        expect(originalParams).toStrictEqual({ a: 1 });
      });

      it('does not mutate the init object passed by the caller', () => {
        const originalInit = {
          method: 'post',
          headers: { Authorization: 'Bearer tok' },
        };
        fetcher('http://example.com/oki', { a: 1 }, originalInit);

        expect(originalInit.headers).not.toHaveProperty('X-Signature');
        expect(originalInit.headers).not.toHaveProperty('Content-Type');
        expect(originalInit).not.toHaveProperty('body');
      });

      it('does not mutate the headers object inside init', () => {
        const originalHeaders = { Authorization: 'Bearer tok' };
        fetcher(
          'http://example.com/oki',
          { a: 1 },
          { headers: originalHeaders }
        );

        expect(originalHeaders).not.toHaveProperty('X-Signature');
        expect(originalHeaders).not.toHaveProperty('Accept');
      });

      it('does not poison params between two successive calls with the same object', () => {
        const sharedParams = { a: 1 };

        fetcher('http://example.com/oki', sharedParams);
        const firstExpiry: string = (mockFetch.mock.lastCall || [])[0]
          .split('expiry=')[1]
          ?.split('&')[0];

        fetcher('http://example.com/oki', sharedParams);
        const secondExpiry: string = (mockFetch.mock.lastCall || [])[0]
          .split('expiry=')[1]
          ?.split('&')[0];

        // Both calls should have produced an expiry (not undefined)
        expect(firstExpiry).toBeTruthy();
        expect(secondExpiry).toBeTruthy();
        // The original object is still unpolluted
        expect(sharedParams).not.toHaveProperty('expiry');
      });
    });

    describe('?? (null-coalescing) expiry', () => {
      it('preserves an explicit expiry of 0 (falsy but defined)', () => {
        fetcher('http://example.com/oki', { a: 1, expiry: 0 });

        const calledUrl: string = (mockFetch.mock.lastCall || [])[0];
        expect(calledUrl).toContain('expiry=0');
      });

      it('preserves any explicit expiry supplied by the caller', () => {
        fetcher('http://example.com/oki', { a: 1, expiry: timestamp + 9999 });

        const calledUrl: string = (mockFetch.mock.lastCall || [])[0];
        expect(calledUrl).toContain(`expiry=${timestamp + 9999}`);
      });
    });

    describe('path extraction', () => {
      it('strips a query string already present in the entry URL when computing the path', () => {
        fetcher('http://example.com/oki?existing=1', { a: 1 });

        const signature: string = (mockFetch.mock.lastCall || [])[1].headers[
          'X-Signature'
        ];
        const finalParams = { a: 1, expiry: timestamp + 90 };
        expect(signature).toEqual(
          sign({
            secret: 'secret',
            params: parseQueryToParams(translateParamsToQuery(finalParams)),
            verb: 'GET',
            path: '/oki',
          })
        );
      });

      it('strips a fragment from the entry URL when computing the path', () => {
        fetcher('http://example.com/oki#section', { a: 1 });

        const signature: string = (mockFetch.mock.lastCall || [])[1].headers[
          'X-Signature'
        ];
        const finalParams = { a: 1, expiry: timestamp + 90 };
        expect(signature).toEqual(
          sign({
            secret: 'secret',
            params: parseQueryToParams(translateParamsToQuery(finalParams)),
            verb: 'GET',
            path: '/oki',
          })
        );
      });

      it('extracts a correct path from a relative URL', () => {
        fetcher('/api/resource', { a: 1 });

        const signature: string = (mockFetch.mock.lastCall || [])[1].headers[
          'X-Signature'
        ];
        const finalParams = { a: 1, expiry: timestamp + 90 };
        expect(signature).toEqual(
          sign({
            secret: 'secret',
            params: parseQueryToParams(translateParamsToQuery(finalParams)),
            verb: 'GET',
            path: '/api/resource',
          })
        );
      });

      it('strips query string from a relative URL when computing the path', () => {
        fetcher('/api/resource?foo=bar', { a: 1 });

        const signature: string = (mockFetch.mock.lastCall || [])[1].headers[
          'X-Signature'
        ];
        const finalParams = { a: 1, expiry: timestamp + 90 };
        expect(signature).toEqual(
          sign({
            secret: 'secret',
            params: parseQueryToParams(translateParamsToQuery(finalParams)),
            verb: 'GET',
            path: '/api/resource',
          })
        );
      });

      it('signs path "/" for an entry with no path (Ruby req.path || "/" parity)', () => {
        fetcher('http://example.com', { a: 1 });

        const signature: string = (mockFetch.mock.lastCall || [])[1].headers[
          'X-Signature'
        ];
        const finalParams = { a: 1, expiry: timestamp + 90 };
        expect(signature).toEqual(
          sign({
            secret: 'secret',
            params: parseQueryToParams(translateParamsToQuery(finalParams)),
            verb: 'GET',
            path: '/',
          })
        );
      });

      it('preserves a double slash in the path (regression guard)', () => {
        fetcher('http://example.com/a//b', { a: 1 });

        const signature: string = (mockFetch.mock.lastCall || [])[1].headers[
          'X-Signature'
        ];
        const finalParams = { a: 1, expiry: timestamp + 90 };
        expect(signature).toEqual(
          sign({
            secret: 'secret',
            params: parseQueryToParams(translateParamsToQuery(finalParams)),
            verb: 'GET',
            path: '/a//b',
          })
        );
      });
    });
  });
});
