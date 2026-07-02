import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';
import type { Server, IncomingMessage, ServerResponse } from 'node:http';
import {
  generateFetcher,
  validateRequest,
  parseQueryToParams,
} from '../../src/index';

const SECRET = 'e2e-test-secret';
let server: Server;
let port: number;

function requestHandler(req: IncomingMessage, res: ServerResponse): void {
  const rawUrl = req.url ?? '/';
  const url = new URL(rawUrl, 'http://localhost');
  const pathname = url.pathname;
  const search = url.search;
  const signature = String(req.headers['x-signature'] ?? '');
  const verb = req.method ?? 'GET';
  const isGet = verb.toUpperCase() === 'GET';

  if (isGet) {
    const params = parseQueryToParams(search);
    const valid = validateRequest({
      secret: SECRET,
      algorithm: 'sha256',
      params,
      verb: 'GET',
      path: pathname,
      signature,
    });
    res.writeHead(valid ? 200 : 401);
    res.end(valid ? 'ok' : 'invalid');
  } else {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf8');

        const params = JSON.parse(body) as Record<string, unknown>;
        const valid = validateRequest({
          secret: SECRET,
          algorithm: 'sha256',
          params,
          verb: verb.toUpperCase(),
          path: pathname,
          signature,
        });
        res.writeHead(valid ? 200 : 401);
        res.end(valid ? 'ok' : 'invalid');
      } catch (_err) {
        res.writeHead(400);
        res.end('bad request');
      }
    });
  }
}

beforeAll(() => {
  return new Promise<void>((resolve) => {
    server = createServer(requestHandler);
    server.listen(0, () => {
      const addr = server.address();
      port = (addr as { port: number }).port;
      resolve();
    });
  });
});

afterAll(() => {
  return new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

const fetcher = generateFetcher({
  fetcher: fetch,
  secret: SECRET,
  algorithm: 'sha256',
});

describe('GET requests — accepted (200)', () => {
  it('accepts scalars', async () => {
    const response = (await fetcher(`http://localhost:${port}/api/resource`, {
      a: 1,
      b: 'x',
      c: true,
    })) as Response;
    expect(response.status).toBe(200);
  });

  it('accepts array of strings', async () => {
    const response = (await fetcher(`http://localhost:${port}/api/resource`, {
      e: ['a', 'b'],
    })) as Response;
    expect(response.status).toBe(200);
  });

  it('accepts array of numbers', async () => {
    const response = (await fetcher(`http://localhost:${port}/api/resource`, {
      e: [1, 2, 3],
    })) as Response;
    expect(response.status).toBe(200);
  });

  it('accepts nested object with numbers/booleans', async () => {
    const response = (await fetcher(`http://localhost:${port}/api/resource`, {
      f: { a: 1, b: true },
    })) as Response;
    expect(response.status).toBe(200);
  });

  it('accepts null value', async () => {
    const response = (await fetcher(`http://localhost:${port}/api/resource`, {
      a: 1,
      g: null,
    })) as Response;
    expect(response.status).toBe(200);
  });

  it('accepts unicode', async () => {
    const response = (await fetcher(`http://localhost:${port}/api/resource`, {
      name: '你好世界',
    })) as Response;
    expect(response.status).toBe(200);
  });

  it('accepts reserved URL chars in value', async () => {
    const response = (await fetcher(`http://localhost:${port}/api/resource`, {
      q: 'a b&c=d',
    })) as Response;
    expect(response.status).toBe(200);
  });
});

describe('POST requests — accepted (200)', () => {
  it('accepts scalars', async () => {
    const response = (await fetcher(
      `http://localhost:${port}/api/resource`,
      { a: 1, b: 'x', c: true },
      { method: 'POST' }
    )) as Response;
    expect(response.status).toBe(200);
  });

  it('accepts array of strings', async () => {
    const response = (await fetcher(
      `http://localhost:${port}/api/resource`,
      { e: ['a', 'b'] },
      { method: 'POST' }
    )) as Response;
    expect(response.status).toBe(200);
  });

  it('accepts array of numbers', async () => {
    const response = (await fetcher(
      `http://localhost:${port}/api/resource`,
      { e: [1, 2, 3] },
      { method: 'POST' }
    )) as Response;
    expect(response.status).toBe(200);
  });

  it('accepts nested object with numbers/booleans', async () => {
    const response = (await fetcher(
      `http://localhost:${port}/api/resource`,
      { f: { a: 1, b: true } },
      { method: 'POST' }
    )) as Response;
    expect(response.status).toBe(200);
  });

  it('accepts null value', async () => {
    const response = (await fetcher(
      `http://localhost:${port}/api/resource`,
      { a: 1, g: null },
      { method: 'POST' }
    )) as Response;
    expect(response.status).toBe(200);
  });

  it('accepts unicode', async () => {
    const response = (await fetcher(
      `http://localhost:${port}/api/resource`,
      { name: '你好世界' },
      { method: 'POST' }
    )) as Response;
    expect(response.status).toBe(200);
  });

  it('accepts reserved URL chars in value', async () => {
    const response = (await fetcher(
      `http://localhost:${port}/api/resource`,
      { q: 'a b&c=d' },
      { method: 'POST' }
    )) as Response;
    expect(response.status).toBe(200);
  });
});

describe('rejected requests (401)', () => {
  it('rejects a request signed with the wrong secret', async () => {
    const badFetcher = generateFetcher({
      fetcher: fetch,
      secret: 'wrong-secret',
      algorithm: 'sha256',
    });
    const response = (await badFetcher(
      `http://localhost:${port}/api/resource`,
      { a: 1 }
    )) as Response;
    expect(response.status).toBe(401);
  });

  it('rejects a request with an expired expiry', async () => {
    const pastExpiry = Math.floor(Date.now() / 1000) - 1000;
    const response = (await fetcher(`http://localhost:${port}/api/resource`, {
      a: 1,
      expiry: pastExpiry,
    })) as Response;
    expect(response.status).toBe(401);
  });

  it('rejects a request with an expiry too far in the future', async () => {
    const farExpiry = Math.floor(Date.now() / 1000) + 10000;
    const response = (await fetcher(`http://localhost:${port}/api/resource`, {
      a: 1,
      expiry: farExpiry,
    })) as Response;
    expect(response.status).toBe(401);
  });

  // Produce a genuinely signed request (correct secret), capturing the URL and
  // headers, so the tampering tests below alter exactly one thing.
  const captureSigned = async (params: Record<string, unknown>) => {
    let captured: { entry: string; init: any } = { entry: '', init: {} };
    const capture = generateFetcher({
      fetcher: (entry: any, init: any) => {
        captured = { entry, init: init ?? {} };
        return Promise.resolve();
      },
      secret: SECRET,
      algorithm: 'sha256',
    });
    await capture(`http://localhost:${port}/api/resource`, params);
    return captured;
  };

  it('rejects a tampered signature (one hex char flipped)', async () => {
    const { entry, init } = await captureSigned({ a: 1 });
    const sig: string = init.headers['X-Signature'];
    const flipped = sig.slice(0, -1) + (sig.slice(-1) === '0' ? '1' : '0');
    const res = await fetch(entry, {
      headers: { ...init.headers, 'X-Signature': flipped },
    });
    expect(res.status).toBe(401);
  });

  it('rejects a tampered param (signed a=1, sent a=2)', async () => {
    const { entry, init } = await captureSigned({ a: 1 });
    const tamperedEntry = entry.replace('a=1', 'a=2');
    expect(tamperedEntry).not.toEqual(entry);
    const res = await fetch(tamperedEntry, { headers: init.headers });
    expect(res.status).toBe(401);
  });

  it('rejects a request with no signature header', async () => {
    const { entry, init } = await captureSigned({ a: 1 });
    const headers = { ...init.headers };
    delete headers['X-Signature'];
    const res = await fetch(entry, { headers });
    expect(res.status).toBe(401);
  });
});
