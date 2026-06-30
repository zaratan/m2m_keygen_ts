import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { encodes } from './helpers/paramsEncoder';
import { ParamsTypes } from './types/paramsTypes';

/**
 * Securely compare two strings in constant time.
 *
 * Both inputs are hashed to a fixed-length SHA-256 digest (32 bytes) before
 * comparison, so `crypto.timingSafeEqual` never throws (equal-length buffers)
 * and no early-return branch leaks information about the relative lengths of
 * the original strings.
 *
 * @param {string} a - first string
 * @param {string} b - second string
 * @returns {boolean} - true if strings are equal, false otherwise
 */
export const secureCompare = (a: string, b: string): boolean => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ha = createHash('sha256').update(a, 'utf8').digest();
  const hb = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(ha, hb);
};

/**
 * Generate a signature from the different part of the request.
 *
 * @param {string} secret - The secret used to sign the request.
 * @param {string|undefined} algorithm - algorithm to use - Default to sha512
 * @param {ParamType} params - params to sign
 * @param {string} verb - http verb
 * @param {string} path - path to sign
 * @returns {string} - The generated signature
 */
export const sign = ({
  secret,
  algorithm = 'sha512',
  params,
  verb,
  path,
}: {
  secret: string;
  algorithm?: string;
  params: ParamsTypes;
  verb: string;
  path: string;
}): string => {
  const hmac = createHmac(algorithm, secret);

  hmac.update(`${verb.toUpperCase()}${path}${encodes(params)}`);

  return hmac.digest('hex');
};

/**
 * Validate the signature of a request.
 *
 * @param {string} secret - The secret used to sign the request.
 * @param {string|undefined} algorithm - algorithm to use - Default to sha512
 * @param {ParamType} params - params to sign
 * @param {string} verb - http verb
 * @param {string} path - path to sign
 * @param {string} signature - signature to check against
 * @returns {boolean} - Is signature is valid
 */
export const validate = ({
  secret,
  algorithm = 'sha512',
  params,
  verb,
  path,
  signature,
}: {
  secret: string;
  algorithm?: string;
  params: ParamsTypes;
  verb: string;
  path: string;
  signature: string;
}) => {
  return secureCompare(
    sign({ secret, algorithm, params, verb, path }),
    signature
  );
};

/**
 * Validate the signature and expiry of a request.
 *
 * Mirrors the Ruby `M2mKeygen::RackValidator#validate` method: the HMAC
 * signature must be valid AND the `expiry` param must be a Unix timestamp
 * strictly greater than `now` and strictly less than `now + expiryWindow`.
 *
 * @param {string} secret - The secret used to sign the request.
 * @param {string|undefined} algorithm - algorithm to use - Default to sha512
 * @param {ParamsTypes} params - params of the request (must include `expiry`)
 * @param {string} verb - HTTP verb
 * @param {string} path - request path
 * @param {string} signature - HMAC signature to check against
 * @param {number|undefined} expiryWindow - Validity window in seconds - Default to 120
 * @returns {boolean} - true if signature is valid and expiry is within the window
 */
export const validateRequest = ({
  secret,
  algorithm = 'sha512',
  params,
  verb,
  path,
  signature,
  expiryWindow = 120,
}: {
  secret: string;
  algorithm?: string;
  params: ParamsTypes;
  verb: string;
  path: string;
  signature: string;
  expiryWindow?: number;
}): boolean => {
  if (!validate({ secret, algorithm, params, verb, path, signature })) {
    return false;
  }

  const rawExpiry = params?.expiry;
  if (rawExpiry == null) return false;

  // `Number()` is intentionally stricter than Ruby's `String#to_i` (which would
  // coerce "12abc" -> 12): a malformed expiry is rejected rather than salvaged.
  // This only diverges for inputs a correct signer never emits — `expiry` is part
  // of the signed payload, so a clean integer timestamp parses identically here
  // and in Ruby.
  const expiry = Number(rawExpiry);
  if (Number.isNaN(expiry)) return false;

  const now = Math.floor(Date.now() / 1000);
  return expiry > now && expiry < now + expiryWindow;
};
