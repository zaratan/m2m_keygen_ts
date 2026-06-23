# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2026-06-23

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

[unreleased]: https://github.com/zaratan/m2m_keygen_ts/compare/v1.0.2...HEAD
[1.0.2]: https://github.com/zaratan/m2m_keygen_ts/releases/tag/v1.0.2
[1.0.1]: https://github.com/Billcorporate/m2m_keygen_ts/releases/tag/v1.0.1
[1.0.0]: https://github.com/Billcorporate/m2m_keygen_ts/releases/tag/v1.0.0
[0.2.0]: https://github.com/Billcorporate/m2m_keygen_ts/releases/tag/v0.2.0
[0.1.3]: https://github.com/Billcorporate/m2m_keygen_ts/releases/tag/v0.1.3
[0.1.2]: https://github.com/Billcorporate/m2m_keygen_ts/releases/tag/v0.1.2
[0.1.1]: https://github.com/Billcorporate/m2m_keygen_ts/releases/tag/v0.1.1
[0.1.0]: https://github.com/Billcorporate/m2m_keygen_ts/releases/tag/v0.1.0
