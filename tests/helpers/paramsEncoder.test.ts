import { describe, it, expect } from 'vitest';
import {
  encodes,
  parseQueryToParams,
  translateParamsToQuery,
} from '../../src/helpers/paramsEncoder';

describe('translateParamsToQuery', () => {
  it('translate params to query with URL-encoded brackets and null omitted', () => {
    expect(
      translateParamsToQuery({
        a: 1,
        b: '2',
        c: true,
        d: false,
        e: [1, 2, 3],
        f: { a: 1, b: 2 },
        g: null,
      })
    ).toEqual(
      '?a=1&b=2&c=true&d=false&e%5B%5D=1&e%5B%5D=2&e%5B%5D=3&f%5Ba%5D=1&f%5Bb%5D=2'
    );
  });

  describe('when there is nothing in params ', () => {
    it('returns empty string', () => {
      expect(translateParamsToQuery({})).toEqual('');
    });
  });

  describe('when top-level value is null', () => {
    it('omits the key', () => {
      expect(translateParamsToQuery({ a: 1, g: null })).toEqual('?a=1');
    });
  });

  describe('when top-level value is empty string', () => {
    it('omits the key', () => {
      expect(translateParamsToQuery({ a: 1, b: '' })).toEqual('?a=1');
    });
  });

  describe('when all top-level values are null', () => {
    it('returns empty string', () => {
      expect(translateParamsToQuery({ a: null, b: null })).toEqual('');
    });
  });

  describe('with URL-special characters in values', () => {
    it('URL-encodes scalar values', () => {
      expect(translateParamsToQuery({ val: 'a&b=c d' })).toEqual(
        '?val=a%26b%3Dc%20d'
      );
    });
  });

  describe('with unicode values', () => {
    it('URL-encodes unicode', () => {
      expect(translateParamsToQuery({ name: '你好' })).toEqual(
        '?name=%E4%BD%A0%E5%A5%BD'
      );
    });
  });
});

describe('parseQueryToParams', () => {
  it('returns empty object for empty string', () => {
    expect(parseQueryToParams('')).toEqual({});
  });

  it('returns empty object for bare question mark', () => {
    expect(parseQueryToParams('?')).toEqual({});
  });

  it('parses scalar values as strings', () => {
    expect(parseQueryToParams('?a=1&b=2')).toEqual({ a: '1', b: '2' });
  });

  it('parses URL-encoded array brackets into string arrays', () => {
    expect(parseQueryToParams('?e%5B%5D=1&e%5B%5D=2')).toEqual({
      e: ['1', '2'],
    });
  });

  it('parses URL-encoded object brackets into string records', () => {
    expect(parseQueryToParams('?f%5Ba%5D=1&f%5Bb%5D=2')).toEqual({
      f: { a: '1', b: '2' },
    });
  });

  it('URL-decodes unicode values', () => {
    expect(parseQueryToParams('?name=%E4%BD%A0%E5%A5%BD')).toEqual({
      name: '你好',
    });
  });

  it('URL-decodes reserved characters in values', () => {
    expect(parseQueryToParams('?val=a%26b%3Dc%20d')).toEqual({
      val: 'a&b=c d',
    });
  });

  it('strips leading question mark before parsing', () => {
    expect(parseQueryToParams('?a=1')).toEqual(parseQueryToParams('a=1'));
  });
});

describe('round-trip: encodes(parseQueryToParams(translateParamsToQuery(p)))', () => {
  it('is stable for scalar string', () => {
    const p = { a: '1' };
    const result = encodes(parseQueryToParams(translateParamsToQuery(p)));
    expect(result).toEqual('a=1');
    // Deterministic: calling twice yields the same result
    expect(encodes(parseQueryToParams(translateParamsToQuery(p)))).toEqual(
      result
    );
  });

  it('is stable for array of numbers, and differs from direct encodes (proves bug fix)', () => {
    const p = { e: [1, 2, 3] };
    const roundTrip = encodes(parseQueryToParams(translateParamsToQuery(p)));
    // After round-trip, array elements become strings
    expect(roundTrip).toEqual('e=["1","2","3"]');
    // Differs from direct encodes which preserves number types
    expect(roundTrip).not.toEqual(encodes(p));
    // Deterministic
    expect(encodes(parseQueryToParams(translateParamsToQuery(p)))).toEqual(
      roundTrip
    );
  });

  it('is stable for nested object with number and boolean, and differs from direct encodes (proves bug fix)', () => {
    const p = { f: { a: 1, b: true } };
    const roundTrip = encodes(parseQueryToParams(translateParamsToQuery(p)));
    // After round-trip, object values become strings
    expect(roundTrip).toEqual('f={"a":"1","b":"true"}');
    // Differs from direct encodes which preserves number and boolean types
    expect(roundTrip).not.toEqual(encodes(p));
    // Deterministic
    expect(encodes(parseQueryToParams(translateParamsToQuery(p)))).toEqual(
      roundTrip
    );
  });

  it('returns empty string for null value (null omitted)', () => {
    const p = { g: null };
    const result = encodes(parseQueryToParams(translateParamsToQuery(p)));
    expect(result).toEqual('');
    expect(encodes(parseQueryToParams(translateParamsToQuery(p)))).toEqual(
      result
    );
  });

  it('returns empty string for empty string value (empty string omitted)', () => {
    const p = { h: '' };
    const result = encodes(parseQueryToParams(translateParamsToQuery(p)));
    expect(result).toEqual('');
    expect(encodes(parseQueryToParams(translateParamsToQuery(p)))).toEqual(
      result
    );
  });

  it('is stable for unicode values', () => {
    const p = { name: '你好' };
    const result = encodes(parseQueryToParams(translateParamsToQuery(p)));
    expect(result).toEqual('name=你好');
    expect(encodes(parseQueryToParams(translateParamsToQuery(p)))).toEqual(
      result
    );
  });

  it('is stable for values with reserved URL characters', () => {
    const p = { val: 'a&b=c d' };
    const result = encodes(parseQueryToParams(translateParamsToQuery(p)));
    expect(result).toEqual('val=a&b=c d');
    expect(encodes(parseQueryToParams(translateParamsToQuery(p)))).toEqual(
      result
    );
  });

  it('returns empty string for empty array (key omitted entirely)', () => {
    // translateParamsToQuery emits nothing for [], so the key vanishes from the query.
    // This pins the intentional behavior: empty arrays do not survive the round-trip.
    const p = { a: 1, b: [] };
    const result = encodes(parseQueryToParams(translateParamsToQuery(p)));
    expect(result).toEqual('a=1');
  });

  it('returns empty string for empty object (key omitted entirely)', () => {
    // Same as empty array: {} produces no query pairs, so the key vanishes.
    const p = { a: 1, b: {} };
    const result = encodes(parseQueryToParams(translateParamsToQuery(p)));
    expect(result).toEqual('a=1');
  });

  it('value containing bracket characters round-trips safely', () => {
    // Brackets inside a value must not be mistaken for the key bracket syntax.
    const p = { filter: 'a[b]' };
    const result = encodes(parseQueryToParams(translateParamsToQuery(p)));
    expect(result).toEqual('filter=a[b]');
  });
});

describe('paramsEncoder', () => {
  describe('simple useCase', () => {
    it('encodes params', () => {
      expect(encodes({ a: '1', b: '2' })).toEqual('a=1&b=2');
    });
  });

  describe('empty params', () => {
    it('encodes params', () => {
      expect(encodes({})).toEqual('');
    });
  });

  describe('null params', () => {
    it('encodes params', () => {
      expect(encodes(null)).toEqual('');
    });
  });

  describe('undefined params', () => {
    it('encodes params', () => {
      expect(encodes(undefined)).toEqual('');
    });
  });

  describe('param with null value', () => {
    it('encodes params', () => {
      expect(encodes({ a: 1, b: null })).toEqual('a=1');
    });
  });

  describe('param with undefined value', () => {
    it('encodes params', () => {
      expect(encodes({ a: 1, b: undefined })).toEqual('a=1');
    });
  });

  describe('param with empty string value', () => {
    it('encodes params', () => {
      expect(encodes({ a: 1, b: '' })).toEqual('a=1');
    });
  });

  describe('when params are not alphabetical', () => {
    it('encodes params', () => {
      expect(encodes({ c: 1, a: 2, b: 3 })).toEqual('a=2&b=3&c=1');
    });
  });

  describe('when keys mix case, underscore and digits', () => {
    // Must match Ruby's `sort_by(&:to_s)` (byte order), NOT a locale-aware sort:
    // digits < uppercase < '_' < lowercase. A `localeCompare` sort would diverge
    // and break TS<->Ruby signature parity.
    it('sorts keys by byte order', () => {
      expect(encodes({ a: 1, B: 2, _x: 3, A: 4, '2': 5 })).toEqual(
        '2=5&A=4&B=2&_x=3&a=1'
      );
    });

    it('sorts nested object keys by byte order too', () => {
      expect(encodes({ outer: { b: 1, A: 2, _k: 3 } })).toEqual(
        'outer={"A":2,"_k":3,"b":1}'
      );
    });
  });

  describe('array value', () => {
    describe('with empty array value', () => {
      it('encodes params', () => {
        expect(encodes({ a: 1, b: [] })).toEqual('a=1&b=[]');
      });
    });

    describe('with array value', () => {
      it('encodes params', () => {
        expect(encodes({ a: 1, b: ['1', '2'] })).toEqual('a=1&b=["1","2"]');
      });
    });
  });

  describe('hash value', () => {
    describe('with empty hash value', () => {
      it('encodes params', () => {
        expect(encodes({ a: 1, b: {} })).toEqual('a=1&b={}');
      });
    });

    describe('with hash value', () => {
      it('encodes params', () => {
        expect(encodes({ a: 1, b: { c: '1', d: 2 } })).toEqual(
          'a=1&b={"c":"1","d":2}'
        );
      });
    });

    describe('with hash value with array value', () => {
      it('encodes params', () => {
        expect(encodes({ a: 1, b: { d: ['1', '2'], c: 1 } })).toEqual(
          'a=1&b={"c":1,"d":["1","2"]}'
        );
      });
    });

    describe('with hash value with hash value', () => {
      it('encodes params', () => {
        expect(encodes({ a: 1, b: { d: { f: 3, e: '1' }, c: 1 } })).toEqual(
          'a=1&b={"c":1,"d":{"e":"1","f":3}}'
        );
      });
    });
  });
});
