# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.6] - 2026-06-30

### Fixed

- The signed-request fetcher no longer mutates the caller's `params`/`init` objects — inputs are treated as immutable. This also fixes a bug where reusing the same `params` object across calls reused the first call's (now stale) `expiry`.
- Request paths are extracted with the URL API: query string and fragment are stripped, a double slash is preserved, and a missing path is normalized to `/` (matching the Ruby server's `req.path`). This removes latent GET signature mismatches when the entry URL already carried a query string.
- A caller-supplied `expiry: 0` is now preserved (was overwritten by the default).

### Changed

- The fetcher API is fully typed (no `any`): `FetchParamsType` and `FetcherInit` are exported and the wrapper is generic over the response type.

## [1.0.5] - 2026-06-23

### Added

- `validateRequest`: validates the HMAC signature **and** enforces the `expiry` param (anti-replay), mirroring the Ruby `RackValidator` (`now < expiry < now + expiryWindow`, window configurable, default 120s). `validate` stays a pure HMAC check.

### Changed

- `secureCompare` now uses `crypto.timingSafeEqual` over fixed-length SHA-256 digests (Rails `variable_size_secure_compare` pattern): constant-time, with no length-based early return.

## [1.0.4] - 2026-06-23

### Fixed

- GET request signatures now match what the server reconstructs from the query string. The client signs the round-tripped params (`parseQueryToParams(translateParamsToQuery(...))`), fixing signature mismatches for params containing numbers/booleans nested in arrays or objects, `null`, or empty collections.
- `translateParamsToQuery` now omits `null`/`undefined`/empty values and URL-encodes keys and values, so reserved characters (`&`, `=`, space, ...) no longer corrupt the query or the signature.
- Sort keys by byte order (matching Ruby's `sort_by(&:to_s)`) instead of a locale-aware comparison, keeping signatures identical across TS and Ruby for mixed-case/underscore keys.

### Added

- `parseQueryToParams` helper (inverse of `translateParamsToQuery`), exported from the package.

## [1.0.3] - 2026-06-23

### Changed

- Migrate package manager from yarn to pnpm.
- Migrate test runner from Jest to Vitest.
- Upgrade all dependencies to their latest versions (ESLint 10, TypeScript 6, Vitest 4, ...).
- Migrate ESLint to flat config and drop the Next.js config dependency.
- Modernize `tsconfig` (`target` ES2022, `nodenext` module resolution).
- Support only non-EOL Node versions (`>=22`); CI matrix on Node 22 and 24.
- Update GitHub Actions to current versions.
- Point repository references to github.com/zaratan/m2m_keygen_ts.

## [1.0.1] - 2033-10-04

### Changed

- Update dependencies

## [1.0.0] - 2022-09-01

### Added

- `generateFetcher` function have been added.
- Helpers functions have been exposed.

### Changed

- Signature container has been removed and all methods are flattened.

## [0.2.0] - 2022-08-31

### Added

- `sign` and `validate` functions in Signature object

### Changed

- Activating cache for GH actions

## [0.1.3] - 2022-08-31

### Changed

- Added various fields in package.json

## [0.1.2] - 2022-08-31

### Added

- Proper Readme
- Husky and Lint-Staged

## [0.1.1] - 2022-08-30

### Changed

- Fixing deploy

## [0.1.0] - 2022-08-30

### Added

- Basic skeleton for the package

[unreleased]: https://github.com/zaratan/m2m_keygen_ts/compare/v1.0.6...HEAD
[1.0.6]: https://github.com/zaratan/m2m_keygen_ts/releases/tag/v1.0.6
[1.0.5]: https://github.com/zaratan/m2m_keygen_ts/releases/tag/v1.0.5
[1.0.4]: https://github.com/zaratan/m2m_keygen_ts/releases/tag/v1.0.4
[1.0.3]: https://github.com/zaratan/m2m_keygen_ts/releases/tag/v1.0.3
[1.0.1]: https://github.com/Billcorporate/m2m_keygen_ts/releases/tag/v1.0.1
[1.0.0]: https://github.com/Billcorporate/m2m_keygen_ts/releases/tag/v1.0.0
[0.2.0]: https://github.com/Billcorporate/m2m_keygen_ts/releases/tag/v0.2.0
[0.1.3]: https://github.com/Billcorporate/m2m_keygen_ts/releases/tag/v0.1.3
[0.1.2]: https://github.com/Billcorporate/m2m_keygen_ts/releases/tag/v0.1.2
[0.1.1]: https://github.com/Billcorporate/m2m_keygen_ts/releases/tag/v0.1.1
[0.1.0]: https://github.com/Billcorporate/m2m_keygen_ts/releases/tag/v0.1.0
