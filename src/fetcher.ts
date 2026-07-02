import {
  parseQueryToParams,
  translateParamsToQuery,
  FetchParamsType,
} from './helpers/paramsEncoder';
import { sign } from './signature';

/**
 * Init object forwarded to the underlying fetcher. It is the standard
 * `RequestInit` with `headers` narrowed to a plain `Record<string, string>`
 * (what the signing layer merges into). Because it is a subtype of `RequestInit`,
 * the native `fetch` can be passed directly as the `fetcher`, and callers can
 * still forward any standard fetch option (credentials, mode, signal, …).
 */
export type FetcherInit = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>;
};

/**
 * Extract the path from an entry URL, stripping query string and fragment.
 *
 * For absolute URLs the URL API is used so query/fragment are never included
 * in the signed path. For relative URLs (no scheme) we fall back to stripping
 * `?` and `#` suffixes with a regex.
 *
 * Note: `new URL('http://host').pathname` returns `'/'` (never empty), which
 * matches Ruby's `req.path || '/'` behaviour and improves parity with the
 * server-side validator. A relative entry WITHOUT a leading slash (e.g. `'oki'`)
 * is returned verbatim — it has no `req.path` equivalent server-side (the server
 * only ever sees a resolved, absolute path), so callers should pass either an
 * absolute URL or an absolute path (`/api/...`).
 *
 * @param {string} entry - full or relative URL
 * @returns {string} - the path component, without query string or fragment
 */
const extractPath = (entry: string): string => {
  try {
    return new URL(entry).pathname;
  } catch {
    // Relative URL: strip query string and fragment
    return entry.replace(/[?#].*$/, '');
  }
};

/**
 * Build the final params object, injecting a default expiry when the caller
 * did not supply one. Uses `??` (not `||`) so an explicit `expiry: 0` is
 * preserved rather than overwritten.
 *
 * @param {FetchParamsType} params - caller-supplied params (not mutated)
 * @returns {FetchParamsType} - a new object with expiry guaranteed
 */
const withDefaultExpiry = (params: FetchParamsType): FetchParamsType => {
  const expiry = params.expiry ?? Math.round(Date.now() / 1000) + 90;
  return { ...params, expiry };
};

/**
 * Build the request init for a GET request. Never mutates `init`.
 *
 * @param {FetcherInit | undefined} init - caller-supplied init
 * @param {string} headerName - signature header name
 * @param {string} signature - computed HMAC
 * @returns {FetcherInit} - a new init with headers applied
 */
const buildGetInit = (
  init: FetcherInit | undefined,
  headerName: string,
  signature: string
): FetcherInit => {
  const headers: Record<string, string> = { ...init?.headers };
  headers[headerName] = signature;
  headers['Accept'] ??= 'application/json';
  return { ...init, headers };
};

/**
 * Build the request init for a non-GET (POST/PUT/…) request. Never mutates `init`.
 *
 * @param {FetcherInit | undefined} init - caller-supplied init
 * @param {string} headerName - signature header name
 * @param {string} signature - computed HMAC
 * @param {FetchParamsType} finalParams - params to JSON-encode as body
 * @returns {FetcherInit} - a new init with headers, body, and Content-Type applied
 */
const buildMutatingInit = (
  init: FetcherInit | undefined,
  headerName: string,
  signature: string,
  finalParams: FetchParamsType
): FetcherInit => {
  const headers: Record<string, string> = { ...init?.headers };
  headers[headerName] = signature;
  headers['Accept'] ??= 'application/json';
  headers['Content-Type'] = 'application/json';
  return { ...init, headers, body: JSON.stringify(finalParams) };
};

/**
 * Wrap a fetcher function so every call is transparently signed with an HMAC
 * signature derived from the request's method, path, and params.
 *
 * The returned fetcher is generic on the response type `R` so callers retain
 * full type safety on the response without casting.
 *
 * Inputs (`params`, `init`) are treated as **immutable**: this function never
 * modifies the objects passed in by the caller.
 *
 * @param fetcher - underlying fetch implementation
 * @param secret - HMAC secret
 * @param algorithm - digest algorithm (default: 'sha512')
 * @param headerName - HTTP header to carry the signature (default: 'X-Signature')
 * @returns a signed wrapper around `fetcher`
 */
export const generateFetcher =
  <R>({
    fetcher,
    secret,
    algorithm = 'sha512',
    headerName = 'X-Signature',
  }: {
    fetcher: (entry: string, init?: FetcherInit) => R;
    secret: string;
    algorithm?: string;
    headerName?: string;
  }) =>
  (entry: string, params: FetchParamsType = {}, init?: FetcherInit): R => {
    const method = init?.method;
    const isGet = !method || method.toUpperCase() === 'GET';
    const path = extractPath(entry);
    const finalParams = withDefaultExpiry(params);

    if (isGet) {
      const query = translateParamsToQuery(finalParams);
      const signedParams = parseQueryToParams(query);
      const signature = sign({
        secret,
        algorithm,
        params: signedParams,
        verb: 'GET',
        path,
      });
      const finalInit = buildGetInit(init, headerName, signature);
      return fetcher(`${entry}${query}`, finalInit);
    }

    const signature = sign({
      secret,
      algorithm,
      params: finalParams,
      verb: method.toUpperCase(),
      path,
    });
    const finalInit = buildMutatingInit(
      init,
      headerName,
      signature,
      finalParams
    );
    return fetcher(entry, finalInit);
  };
