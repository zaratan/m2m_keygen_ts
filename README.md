# M2mKeygen

This library simplifies Machine to Machine (M2M) signature generation and verification in a secure way.

It is signature-compatible with the Ruby gem [`m2m_keygen`](https://github.com/zaratan/m2m_keygen_ruby): a request signed by this TypeScript client validates against the Ruby server, and vice versa.

## Installation

Add the package to your project by executing:

    $ pnpm add m2m-keygen

or with npm

    $ npm install --save m2m-keygen

## Usage

### Signing

Use the `sign` method to generate a signature for an HTTP request.

- `secret` is your shared secret key.
- `algorithm` is the HMAC algorithm — optional, defaults to `sha512`.
- `params` is the params object. The order of keys does not matter; the library canonicalizes them.
- `verb` is the HTTP verb.
- `path` is the request path (without query string).

```ts
import { sign } from "m2m-keygen";

sign({
  secret: "my_secret_key",
  algorithm: "sha256", // optional, defaults to sha512
  params: {
    a: "test",
    b: 1,
    d: ["a", "b"],
    c: { e: 45 },
  },
  verb: "get",
  path: "/path",
});
// => "a52168521868ebb37a38f90ec943163d9acb6ceb982206f437e1feb9ca32e7c1a8edef68f0ff4e195aeca1da93ae9afc8da214cb51a812fc6cc3730fdc7613fa"
```

Send the resulting signature alongside your request (typically in a header) so the receiver can verify it.

### Verifying

Use `validate` to check that a received signature matches the request. It takes a single object argument.

```ts
import { validate } from "m2m-keygen";

validate({
  secret: "my_secret_key",
  params: {
    a: "test",
    b: 1,
    d: ["a", "b"],
    c: { e: 45 },
  },
  verb: "get",
  path: "/path",
  signature:
    "a52168521868ebb37a38f90ec943163d9acb6ceb982206f437e1feb9ca32e7c1a8edef68f0ff4e195aeca1da93ae9afc8da214cb51a812fc6cc3730fdc7613fa",
}); // => true
```

`validate` performs a constant-time HMAC comparison only. It does **not** check any expiry — use `validateRequest` for that.

### Verifying with anti-replay (`validateRequest`)

`validateRequest` validates the signature **and** enforces the `expiry` param, mirroring the Ruby `RackValidator`. It returns `true` only when the signature is valid and `now < expiry < now + expiryWindow`.

```ts
import { validateRequest } from "m2m-keygen";

validateRequest({
  secret: "my_secret_key",
  params: { a: "test", expiry: 1893456000 },
  verb: "get",
  path: "/path",
  signature: "…",
  expiryWindow: 120, // optional, in seconds, defaults to 120
}); // => true if the signature is valid AND the expiry is within the window
```

`expiry` is a Unix timestamp (seconds). The `generateFetcher` helper below injects one automatically.

### Fetch API with automatic signing and expiry

`generateFetcher` wraps any fetch-compatible function so every request is signed and given an expiry automatically.

The returned fetcher takes 3 arguments:

- the URL (its path, without query string, is what gets signed);
- an object with the params to send;
- an optional init object forwarded to the underlying fetch (method, headers, …).

It adds an `expiry` 90 seconds in the future (unless `params.expiry` is already set), then encodes the params as a query string (GET) or as a JSON body (POST/PUT/…) depending on the method.

```ts
import { generateFetcher } from "m2m-keygen";

const fetcher = generateFetcher({
  fetcher: fetch, // any function compatible with the fetch API
  secret: "secret",
  algorithm: "sha512", // optional, defaults to sha512
  headerName: "X-Signature", // optional, defaults to X-Signature
});

// Apart from the params/body/query handling, the returned fetcher behaves like fetch.
fetcher(
  "http://example.com/oki",
  { a: 1, b: 2 },
  { method: "post", headers: { "My-Header": "Yay" } }
)
  .then((res) => console.log(res))
  .catch((err) => console.log(err));
```

The caller's `params` and `init` objects are treated as immutable and are never modified.

### Helpers

The library also exposes a few helpers.

#### translateParamsToQuery

Encodes a params object into a URL query string (Rack/Rails bracket notation). Keys and values are URL-encoded, and `null`/`undefined`/empty values are omitted.

```ts
import { translateParamsToQuery } from "m2m-keygen";

translateParamsToQuery({
  a: 1,
  b: "2",
  c: true,
  d: false,
  e: [1, 2, 3],
  f: { a: 1, b: 2 },
  g: null,
});
// => "?a=1&b=2&c=true&d=false&e%5B%5D=1&e%5B%5D=2&e%5B%5D=3&f%5Ba%5D=1&f%5Bb%5D=2"
// (g is omitted; %5B%5D is "[]", %5Ba%5D is "[a]")
```

#### parseQueryToParams

The inverse of `translateParamsToQuery` — reconstructs params from a query string the way a Rack server does (all scalar values come back as strings).

```ts
import { parseQueryToParams } from "m2m-keygen";

parseQueryToParams("?a=1&e%5B%5D=x&e%5B%5D=y&f%5Ba%5D=z");
// => { a: "1", e: ["x", "y"], f: { a: "z" } }
```

#### secureCompare

Compares two strings in constant time using `crypto.timingSafeEqual` over fixed-length SHA-256 digests, so there is no length-based early return (the Rails `variable_size_secure_compare` pattern).

```ts
import { secureCompare } from "m2m-keygen";

secureCompare("abc", "abc"); // => true
secureCompare("你好世界", "你好世界"); // => true
secureCompare("abc", "ab"); // => false
secureCompare("abc", "abd"); // => false
```

## How it works

This is intended for a secure exchange between two servers, not for use in a browser — the secret key must be stored and used on both sides (and you never want to ship the secret to a browser).

Both servers share the same secret key. The sender generates a signature for the HTTP request it is about to send and adds it to a designated header. The receiver regenerates the signature from the request it received and compares it with the one in the header. The comparison is done in constant time via `crypto.timingSafeEqual`.

### Cross-language notes (Ruby gem)

Signatures are computed over a canonical string that both this library and the Ruby gem produce identically, so GET and POST requests round-trip across languages. One current limitation: the Ruby gem does not accept **boolean** values inside a JSON **POST body**. Booleans work fine in a GET query string (they are stringified to `"true"`/`"false"`). If you target the Ruby validator with a POST, send booleans as strings or numbers.

## Development

After checking out the repo, run `pnpm install` to install dependencies, then `pnpm test` to run the tests.

Every commit/push is checked by husky.

Tools used in development:

- ESLint
- Prettier
- TypeScript
- Vitest

## Contributing

Bug reports and pull requests are welcome on GitHub at https://github.com/zaratan/m2m_keygen_ts. This project is intended to be a safe, welcoming space for collaboration, and contributors are expected to adhere to the [code of conduct](https://github.com/zaratan/m2m_keygen_ts/blob/main/CODE_OF_CONDUCT.md).

## License

This package is available as open source under the terms of the [MIT License](https://opensource.org/licenses/MIT).

## Code of Conduct

Everyone interacting in the M2mKeygen project's codebases, issue trackers, chat rooms and mailing lists is expected to follow the [code of conduct](https://github.com/zaratan/m2m_keygen_ts/blob/main/CODE_OF_CONDUCT.md).
