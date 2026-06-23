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
});
