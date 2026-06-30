import { ParamsTypes, ParamsValueType } from '../types/paramsTypes';

export type FetchParamsType = {
  [key: string]:
    | null
    | boolean
    | number
    | string
    | Array<boolean | number | string>
    | { [key: string]: boolean | number | string };
};

/**
 * Whether a value is "present" (signable / sendable). Mirrors the filtering of
 * the Ruby `ParamsEncoder`: null, undefined and '' are dropped.
 *
 * @param {T} value - value to test
 * @returns {boolean} - true unless the value is null, undefined or ''
 */
const isPresent = <T>(value: T): value is Exclude<T, null | undefined> =>
  value !== null && value !== undefined && value !== '';

/**
 * Compare entry keys by code unit, matching Ruby's `String#<=>` (byte order) so
 * the signable string is byte-for-byte identical on the TS and Ruby sides.
 * NOT locale-aware (digits < uppercase < '_' < lowercase) — using
 * `localeCompare` here would case-fold and diverge from Ruby's `sort_by(&:to_s)`.
 *
 * @param {[string, unknown]} a - first [key, value] entry
 * @param {[string, unknown]} b - second [key, value] entry
 * @returns {number} - <0 if a's key sorts first, >0 if last, 0 if equal
 */
const byKey = (a: [string, unknown], b: [string, unknown]): number =>
  a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;

/**
 * Encode a single scalar param as a URL-encoded `key=value` pair.
 *
 * @param {string} key - param key
 * @param {string | number | boolean} value - scalar value
 * @returns {string} - the encoded `key=value` pair
 */
const encodeScalar = (key: string, value: string | number | boolean): string =>
  `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;

/**
 * Encode an array param as Rack bracket pairs (`key[]=a&key[]=b`).
 * null/undefined/'' items are dropped.
 *
 * @param {string} key - param key
 * @param {Array<boolean | number | string>} items - array values
 * @returns {Array<string>} - the encoded `key[]=value` pairs
 */
const encodeArray = (
  key: string,
  items: Array<boolean | number | string>
): Array<string> => {
  const encodedKey = `${encodeURIComponent(key)}%5B%5D`;
  return items
    .filter(isPresent)
    .map((item) => `${encodedKey}=${encodeURIComponent(String(item))}`);
};

/**
 * Encode an object param as Rack bracket pairs (`key[sub]=value`).
 * Sub-entries whose value is null/undefined/'' are dropped.
 *
 * @param {string} key - param key
 * @param {{ [key: string]: boolean | number | string }} obj - object value
 * @returns {Array<string>} - the encoded `key[sub]=value` pairs
 */
const encodeObject = (
  key: string,
  obj: { [key: string]: boolean | number | string }
): Array<string> =>
  Object.entries(obj)
    .filter(([, v]) => isPresent(v))
    .map(
      ([subKey, subVal]) =>
        `${encodeURIComponent(key)}%5B${encodeURIComponent(subKey)}%5D=${encodeURIComponent(String(subVal))}`
    );

/**
 * Encode the parameters to be signed, Rails way.
 *
 * @param {FetchParamsType} params - params to sign
 * @returns {string} - The encoded parameters
 */
export const translateParamsToQuery = (params: FetchParamsType): string => {
  if (Object.keys(params).length === 0) return '';

  const parts = Object.entries(params).reduce<Array<string>>(
    (current, [nextKey, nextItem]) => {
      if (!isPresent(nextItem)) {
        return current;
      }

      let value: Array<string> = [];
      switch (typeof nextItem) {
        case 'boolean':
        case 'number':
        case 'string':
          value = [encodeScalar(nextKey, nextItem)];
          break;

        case 'object':
          if (Array.isArray(nextItem)) {
            value = encodeArray(nextKey, nextItem);
          } else {
            value = encodeObject(nextKey, nextItem);
          }
          break;

        default:
          break;
      }
      return [...current, ...value];
    },
    []
  );

  if (parts.length === 0) return '';
  return `?${parts.join('&')}`;
};

type ParsedParams = {
  [key: string]: string | string[] | { [k: string]: string };
};

/**
 * Decode a query-string component the way Rack does: '+' becomes a space, then
 * %xx sequences are decoded.
 *
 * @param {string} s - raw (encoded) key or value
 * @returns {string} - the decoded string
 */
const rackDecode = (s: string): string =>
  decodeURIComponent(s.replace(/\+/g, ' '));

/**
 * Inverse of `translateParamsToQuery`: parse a query string back into params.
 * Reproduces, for the shapes `translateParamsToQuery` emits, what Rack's
 * `parse_nested_query` reconstructs server-side — so the client can sign exactly
 * what the server re-encodes. All scalar values are returned as strings
 * (URL-decoded, '+' treated as space). This is the inverse of
 * `translateParamsToQuery`, NOT a general-purpose Rack parser.
 *
 * Supported nesting matches what `translateParamsToQuery` produces: flat scalars,
 * one level of array (`key[]`) and one level of object (`key[sub]`). Object
 * sub-keys must not themselves contain '[' or ']'.
 *
 * @param {string} query - query string to parse (with or without leading '?')
 * @returns {ParsedParams} - parsed parameters
 */
export const parseQueryToParams = (query: string): ParsedParams => {
  const stripped = query.startsWith('?') ? query.slice(1) : query;
  if (stripped === '') return {};

  const result: ParsedParams = {};

  for (const pair of stripped.split('&')) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) continue;

    const rawKey = pair.slice(0, eqIndex);
    const rawVal = pair.slice(eqIndex + 1);
    const decodedKey = rackDecode(rawKey);
    const decodedVal = rackDecode(rawVal);

    // Match bracket notation: key[subkey] or key[] (after decoding the key)
    const arrayMatch = decodedKey.match(/^(.+)\[\]$/);
    const objectMatch = decodedKey.match(/^(.+)\[(.+)\]$/);

    if (arrayMatch) {
      const baseKey = arrayMatch[1];
      const existing = result[baseKey];
      if (Array.isArray(existing)) {
        existing.push(decodedVal);
      } else {
        result[baseKey] = [decodedVal];
      }
    } else if (objectMatch) {
      const baseKey = objectMatch[1];
      const subKey = objectMatch[2];
      const existing = result[baseKey];
      if (typeof existing === 'object' && !Array.isArray(existing)) {
        existing[subKey] = decodedVal;
      } else {
        result[baseKey] = { [subKey]: decodedVal };
      }
    } else {
      result[decodedKey] = decodedVal;
    }
  }

  return result;
};

/**
 * Render an already-canonicalized value for the signable string: scalars as-is,
 * arrays/objects as JSON.
 *
 * @param {ParamsValueType} value - value to render
 * @returns {string | number | boolean} - the scalar or its JSON representation
 */
const jsonifyValue = (value: ParamsValueType): string | number | boolean => {
  if (typeof value !== 'object') return value;
  return JSON.stringify(value);
};

/**
 * Canonicalize a value before signing: objects get their keys filtered/sorted
 * recursively; arrays and scalars are returned untouched.
 *
 * @param {ParamsValueType} value - value to canonicalize
 * @returns {ParamsValueType} - the canonicalized value
 */
const encodeValue = (value: ParamsValueType): ParamsValueType => {
  if (typeof value === 'object' && !Array.isArray(value))
    return encodeHashValue(value);
  return value;
};

/**
 * Canonicalize an object value: drop absent entries, sort keys by byte order,
 * and recurse into nested objects.
 *
 * @param {ParamsValueType} value - object value to canonicalize
 * @returns {ParamsValueType} - the canonicalized object
 */
const encodeHashValue = (value: ParamsValueType): ParamsValueType => {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, v]) => isPresent(v))
      .sort(byKey)
      .map(([key, value]) => [key, encodeValue(value)])
  );
};

export const encodes = (params: ParamsTypes): string => {
  if (params === null || params === undefined) return '';

  return Object.entries(params)
    .filter(([, v]) => isPresent(v))
    .sort(byKey)
    .map(
      ([key, value]) =>
        `${key}=${jsonifyValue(encodeValue(value as ParamsValueType))}`
    )
    .join('&');
};
