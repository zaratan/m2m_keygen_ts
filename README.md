# M2mKeygen

This library exists to simplify Machine to Machine signature generation and verification in a secure way.

## Installation

Add the package to your project by executing:

    $ pnpm add m2m-keygen

or with npm

    $ npm install --save m2m-keygen

## Usage

### Signature

This library provides a module for signing and checking signatures for HTTP requests.

Every method uses your secret key and optionally an encryption algorithm.

```ts
import { sign } from 'm2m-keygen';

const signed = sign({ secret: "my_secret_key", algorithm: "sha256", ... });

const signed = sign({ secret: "my_secret_key", ... }); // => Will default algorithm to sha512
```

#### Signing

Use the `sign` method to generate a new signature.

- `params` is a params hash. The order of keys isn't important as the lib will reformat them.
- `verb` is the HTTP verb
- `path` is the path for the request

```ts
import { sign } from "m2m-keygen";

sign({
  secret: "my_secret_key",
  params: {
    a: "test",
    b: 1,
    d: ["a", "b"],
    c: {
      e: 45,
    },
  },
  verb: "get",
  path: "/path",
}); // => "a52168521868ebb37a38f90ec943163d9acb6ceb982206f437e1feb9ca32e7c1a8edef68f0ff4e195aeca1da93ae9afc8da214cb51a812fc6cc3730fdc7613fa"
```

After generating the signature, send it alongside your request for verification on the receiver side.

#### Verifying

Use the `validate` method to verify that a received signature corresponds to the HTTP request.

- `params` is a params hash. The order of keys isn't important as the lib will reformat them.
- `verb` is the HTTP verb
- `path` is the path for the request
- `signature` is the received signature

```ts
import { validate } from "m2m-keygen";

validate({
  secret: "my_secret_key",
  params: {
    a: "test",
    b: 1,
    d: ["a", "b"],
    c: {
      e: 45,
    },
  },
  verb: "get",
  path: "/path",
  signature:
    "a52168521868ebb37a38f90ec943163d9acb6ceb982206f437e1feb9ca32e7c1a8edef68f0ff4e195aeca1da93ae9afc8da214cb51a812fc6cc3730fdc7613fa",
}); // => true
```

If the validation is true, the request was signed with the same algorithm and the same secret key.

#### Verifying with expiry

Use the `validateRequest` method to verify the signature **and** enforce the `expiry` param (anti-replay). It takes everything `validate` takes and also checks that `expiry` is in the future and within a window.

- `expiry` (in `params`) is a Unix timestamp in seconds. `generateFetcher` adds one automatically.
- `expiryWindow` is the allowed window in seconds (optional, default to 120)

```ts
import { validateRequest } from "m2m-keygen";

validateRequest({
  secret: "my_secret_key",
  params: { a: "test", expiry: 1893456000 },
  verb: "get",
  path: "/path",
  signature: "…",
  expiryWindow: 120, // optional, default to 120
}); // => true if the signature is valid and now < expiry < now + expiryWindow
```

#### Fetch API with auto signature generation and expiry

A helper has been added to generate a fetch function that will automatically sign the request and add an expiry.

The `fetcher` argument is any function that is compatible with the fetch API.

The result behaves slightly differently from a normal fetch function. It expects you to use 3 arguments:

- The first one is the path without any query arguments
- The second one is an object with the params to be sent
- The last one is anything you would like to pass to the fetch function as a second argument (method, headers, …).

The fetcher will add an expiry 90 seconds in the future (unless a previous expiry is already in params).
It will then transform the params into query arguments or encode them as JSON in the body depending on the method (GET, POST, …) you use.

```ts
import { generateFetcher } from "m2m-keygen";

const fetcher = generateFetcher({
  fetcher: fetch, // fetch can be any function compatible with the fetch API
  secret: "secret",
  algorithm: "sha512", // optional, default to sha512
  headerName: "X-Signature", // optional, default to X-Signature
});

// The generated fetcher, except for the params/body/query will behave exactly like fetch does.
fetcher(
  "http://example.com/oki",
  { a: 1, b: 2 },
  { method: "post", headers: { "My-Header": "Yay" } }
)
  .then((res) => {
    console.log(res);
  })
  .catch((err) => {
    console.log(err);
  });
```

The `params` and `init` objects you pass are never mutated.

#### Helpers

This lib exposes a few helpers that can be used in other projects.

##### translateParamsToQuery

This helper will translate a params hash to a query string.
Null/undefined/empty values are dropped and keys/values are URL-encoded.

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
}); // => '?a=1&b=2&c=true&d=false&e%5B%5D=1&e%5B%5D=2&e%5B%5D=3&f%5Ba%5D=1&f%5Bb%5D=2'
```

##### parseQueryToParams

This helper does the opposite of `translateParamsToQuery`: it parses a query string back into a params hash (the way a Rack server does — every scalar comes back as a string).

```ts
import { parseQueryToParams } from "m2m-keygen";

parseQueryToParams("?a=1&e%5B%5D=x&e%5B%5D=y&f%5Ba%5D=z");
// => { a: "1", e: ["x", "y"], f: { a: "z" } }
```

##### secureCompare

This helper will compare two strings in a secure (constant time) way, using `crypto.timingSafeEqual` on the SHA-256 digests of the inputs.

```ts
import { secureCompare } from "m2m-keygen";

secureCompare("abc", "abc"); // => true

secureCompare("你好世界", "你好世界"); // => true

secureCompare("abc", "ab"); // => false

secureCompare("abc", "abd"); // => false
```

## How does it work

This is intended for a secure discussion between 2 servers and not something in a browser as the secret key must be stored and used on both sides (and you don't want to send the secret key in the browser).

Both servers will have the same secret key.
The sender will generate a signature matching the HTTP request it will be sending and add it to the request in a designated header.
The receiver will generate the same signature from the HTTP request it has received and will compare it with the signature in the header.

The comparison will be done in constant time (i.e. secure) using `crypto.timingSafeEqual`.

## Development

After checking out the repo, run `pnpm install` to install dependencies. Then, run `pnpm test` to run the tests.

Every commit/push is checked by husky.

Tools used in dev:

- ESLint
- Prettier
- TypeScript
- Vitest

## Contributing

Bug reports and pull requests are welcome on GitHub at https://github.com/zaratan/m2m_keygen_ts. This project is intended to be a safe, welcoming space for collaboration, and contributors are expected to adhere to the [code of conduct](https://github.com/zaratan/m2m_keygen_ts/blob/main/CODE_OF_CONDUCT.md).

## License

This library is available as open source under the terms of the [MIT License](https://opensource.org/licenses/MIT).

## Code of Conduct

Everyone interacting in the M2mKeygen project's codebases, issue trackers, chat rooms and mailing lists is expected to follow the [code of conduct](https://github.com/zaratan/m2m_keygen_ts/blob/main/CODE_OF_CONDUCT.md).
