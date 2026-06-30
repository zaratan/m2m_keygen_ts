import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  sign,
  validate,
  validateRequest,
  secureCompare,
} from '../src/signature';

describe('#sign', () => {
  const secret = 'secret';
  const algorithm = 'sha256';
  const verb = 'get';
  const path = '/path';
  const params = { b: '1', a: '2' };

  it('returns signature', () => {
    expect(sign({ secret, algorithm, params, verb, path })).toEqual(
      // Signature generated using OpenSSL cli
      // echo "GET/patha=2&b=1" | perl -0 -pe 's/\n\Z//' | openssl sha256 -hmac "secret"
      '7d86fa8a7f871589697b0f41542d065b1ddbbe155e83349fffd937edcfa85af7'
    );
  });
});

describe('#validate', () => {
  const secret = 'secret';
  const algorithm = 'sha256';
  const verb = 'get';
  const path = '/path';
  const params = { b: '1', a: '2' };

  describe('with a valid signature', () => {
    const signature =
      '7d86fa8a7f871589697b0f41542d065b1ddbbe155e83349fffd937edcfa85af7';

    it('returns true', () => {
      expect(
        validate({ secret, algorithm, params, verb, path, signature })
      ).toBe(true);
    });
  });
  describe('with a invalid length signature', () => {
    const signature =
      '7d86fa8a7f871589697b0f41542d065b1ddbbe155e83349fffd937edcfa85af';

    it('returns false', () => {
      expect(
        validate({ secret, algorithm, params, verb, path, signature })
      ).toBe(false);
    });
  });
  describe('with a invalid signature', () => {
    const signature =
      '7d86fa8a7f871589697b0f41542d065b1ddbbe155e83349fffd937edcfa85af8';

    it('returns false', () => {
      expect(
        validate({ secret, algorithm, params, verb, path, signature })
      ).toBe(false);
    });
  });
});

describe('secureCompare', () => {
  it('return true if the strings are identical', () => {
    expect(secureCompare('abc', 'abc')).toBe(true);
  });

  it('return true if the strings are identical in utf8', () => {
    expect(secureCompare('你好世界', '你好世界')).toBe(true);
  });

  it('should return false if the strings are different lengths', () => {
    expect(secureCompare('abc', 'ab')).toBe(false);
  });

  it('should return false if the strings have different contents', () => {
    expect(secureCompare('abc', 'abd')).toBe(false);
  });
});

describe('#validateRequest', () => {
  // Fixed Unix timestamp used as "now" across all tests: 1700000000 s
  const FIXED_NOW_S = 1700000000;
  const FIXED_MS = FIXED_NOW_S * 1000;

  const secret = 'secret';
  const algorithm = 'sha256';
  const verb = 'POST';
  const path = '/api/resource';

  // Signatures pre-computed with:
  //   createHmac('sha256', 'secret').update('POST/api/resource' + encodes(params)).digest('hex')
  // where encodes() sorts keys alphabetically and joins as key=value&...
  const SIG_EXPIRY_NOW_PLUS_60 =
    '4f09278717fda1801800d232bd998f3ef1879a2399c8be6968aa65ca32769032';
  const SIG_EXPIRY_NOW_MINUS_10 =
    'b7c3c08e5930bf6a0820040044831ca98f32a5320fd506dbb1b1a494cfdce1ba';
  const SIG_EXPIRY_NOW_PLUS_200 =
    'b5b6265400d982bba149f2777018b37427fe291fa5d14ac4a9e9098f6584fbfa';
  const SIG_NO_EXPIRY =
    '868a76dea6de710003bdbfcd31e964fe61772febcb6265fe5c3ff243bbf3bf1b';
  const SIG_NON_NUMERIC_EXPIRY =
    'b2dc7cbc5e78a72aafa0704cfb8266215ba5a0235398aad2b3a10117829e3915';
  const SIG_EXPIRY_NOW_PLUS_50 =
    'dfb925cf498a180a64ff9c005941c2c9974a4b2d250d47eb78979c8840f1deb4';
  const SIG_EXPIRY_NOW =
    '5703b5dd73c798c0bb0cd2055638a9e43677e5053ee43b41f660f8c0b6e557df';
  const SIG_EXPIRY_NOW_PLUS_120 =
    '65e75afeccd97ac75347c218a1aaed32b8620500ab9b289321e1d22cc43a4f6f';

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns true when signature is valid and expiry is within the window', () => {
    vi.setSystemTime(new Date(FIXED_MS));
    expect(
      validateRequest({
        secret,
        algorithm,
        verb,
        path,
        params: { expiry: String(FIXED_NOW_S + 60) },
        signature: SIG_EXPIRY_NOW_PLUS_60,
      })
    ).toBe(true);
  });

  it('returns false when expiry is in the past', () => {
    vi.setSystemTime(new Date(FIXED_MS));
    expect(
      validateRequest({
        secret,
        algorithm,
        verb,
        path,
        params: { expiry: String(FIXED_NOW_S - 10) },
        signature: SIG_EXPIRY_NOW_MINUS_10,
      })
    ).toBe(false);
  });

  it('returns false when expiry exceeds now + expiryWindow', () => {
    vi.setSystemTime(new Date(FIXED_MS));
    expect(
      validateRequest({
        secret,
        algorithm,
        verb,
        path,
        params: { expiry: String(FIXED_NOW_S + 200) },
        signature: SIG_EXPIRY_NOW_PLUS_200,
      })
    ).toBe(false);
  });

  it('returns false when params has no expiry field', () => {
    vi.setSystemTime(new Date(FIXED_MS));
    expect(
      validateRequest({
        secret,
        algorithm,
        verb,
        path,
        params: {},
        signature: SIG_NO_EXPIRY,
      })
    ).toBe(false);
  });

  it('returns false when expiry is a non-numeric string', () => {
    vi.setSystemTime(new Date(FIXED_MS));
    expect(
      validateRequest({
        secret,
        algorithm,
        verb,
        path,
        params: { expiry: 'abc' },
        signature: SIG_NON_NUMERIC_EXPIRY,
      })
    ).toBe(false);
  });

  it('returns false when the signature is invalid even if expiry is valid', () => {
    vi.setSystemTime(new Date(FIXED_MS));
    expect(
      validateRequest({
        secret,
        algorithm,
        verb,
        path,
        params: { expiry: String(FIXED_NOW_S + 60) },
        signature: 'deadbeef',
      })
    ).toBe(false);
  });

  it('respects a custom expiryWindow — returns false when expiry is outside the custom window', () => {
    vi.setSystemTime(new Date(FIXED_MS));
    // expiry = now + 50, window = 30 → 50 >= 30 → false
    expect(
      validateRequest({
        secret,
        algorithm,
        verb,
        path,
        params: { expiry: String(FIXED_NOW_S + 50) },
        signature: SIG_EXPIRY_NOW_PLUS_50,
        expiryWindow: 30,
      })
    ).toBe(false);
  });

  it('respects a custom expiryWindow — returns true when expiry is within the custom window', () => {
    vi.setSystemTime(new Date(FIXED_MS));
    // expiry = now + 50, window = 60 → 50 < 60 → true
    expect(
      validateRequest({
        secret,
        algorithm,
        verb,
        path,
        params: { expiry: String(FIXED_NOW_S + 50) },
        signature: SIG_EXPIRY_NOW_PLUS_50,
        expiryWindow: 60,
      })
    ).toBe(true);
  });

  it('handles a string-numeric expiry (as received after GET query reparse)', () => {
    vi.setSystemTime(new Date(FIXED_MS));
    // expiry is already a string '1700000060', Number() must parse it correctly
    expect(
      validateRequest({
        secret,
        algorithm,
        verb,
        path,
        params: { expiry: String(FIXED_NOW_S + 60) },
        signature: SIG_EXPIRY_NOW_PLUS_60,
      })
    ).toBe(true);
  });

  it('rejects expiry exactly equal to now (strict lower bound)', () => {
    vi.setSystemTime(new Date(FIXED_MS));
    expect(
      validateRequest({
        secret,
        algorithm,
        verb,
        path,
        params: { expiry: String(FIXED_NOW_S) },
        signature: SIG_EXPIRY_NOW,
      })
    ).toBe(false);
  });

  it('rejects expiry exactly equal to now + expiryWindow (strict upper bound, default 120)', () => {
    vi.setSystemTime(new Date(FIXED_MS));
    expect(
      validateRequest({
        secret,
        algorithm,
        verb,
        path,
        params: { expiry: String(FIXED_NOW_S + 120) },
        signature: SIG_EXPIRY_NOW_PLUS_120,
      })
    ).toBe(false);
  });

  it('returns false for an empty-string expiry', () => {
    vi.setSystemTime(new Date(FIXED_MS));
    // encodes() filters out '' values, so the signable string equals the
    // no-expiry one; Number('') === 0, which is < now → rejected.
    expect(
      validateRequest({
        secret,
        algorithm,
        verb,
        path,
        params: { expiry: '' },
        signature: SIG_NO_EXPIRY,
      })
    ).toBe(false);
  });

  it('returns false when params is undefined', () => {
    vi.setSystemTime(new Date(FIXED_MS));
    expect(
      validateRequest({
        secret,
        algorithm,
        verb,
        path,
        params: undefined,
        signature: SIG_NO_EXPIRY,
      })
    ).toBe(false);
  });
});
