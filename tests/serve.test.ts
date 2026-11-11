// Phase 7: the small server that serves the website on CranL (tools/serve.ts).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serve } from '../tools/serve.ts';

let root = '';
let server: Server;
let port = 0;

/** A raw request, so the address reaches the server exactly as written. */
function get(path: string, method = 'GET'): Promise<{ status: number; headers: Record<string, unknown>; body: string }> {
  return new Promise((done, fail) => {
    const req = request({ host: '127.0.0.1', port, path, method }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => done({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on('error', fail);
    req.end();
  });
}

beforeAll(async () => {
  const parent = mkdtempSync(join(tmpdir(), 'raqaa-serve-'));
  root = join(parent, 'dist');
  mkdirSync(join(root, 'assets'), { recursive: true });
  writeFileSync(join(root, 'index.html'), '<!doctype html><title>رقعة</title>');
  writeFileSync(join(root, 'sw.js'), 'self.addEventListener("install", () => {});');
  writeFileSync(join(root, 'manifest.webmanifest'), '{}');
  writeFileSync(join(root, 'assets', 'index-4f2a.js'), 'console.log(1)');
  writeFileSync(join(parent, 'secret.txt'), 'outside');
  server = await serve(root, 0);
  port = (server.address() as AddressInfo).port;
});

afterAll(() => {
  server.close();
  rmSync(join(root, '..'), { recursive: true, force: true });
});

describe('the website server', () => {
  it('serves the page at the root, checked again on every visit', async () => {
    const page = await get('/');
    expect(page.status).toBe(200);
    expect(page.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(page.headers['cache-control']).toBe('no-cache');
    expect(page.body).toContain('رقعة');
  });

  it('serves the service worker and the manifest with their types, checked again on every visit', async () => {
    const worker = await get('/sw.js');
    expect(worker.headers['content-type']).toBe('text/javascript; charset=utf-8');
    expect(worker.headers['cache-control']).toBe('no-cache');
    const manifest = await get('/manifest.webmanifest');
    expect(manifest.headers['content-type']).toBe('application/manifest+json; charset=utf-8');
  });

  it('lets browsers keep the hashed files for a year', async () => {
    const asset = await get('/assets/index-4f2a.js');
    expect(asset.status).toBe(200);
    expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('answers a missing file, an address outside the folder, or a broken one, without serving anything else', async () => {
    expect((await get('/nothing.js')).status).toBe(404);
    expect((await get('/../secret.txt')).status).toBe(404);
    expect((await get('/%2e%2e/secret.txt')).status).toBe(404);
    expect((await get('/%E0%A4%A')).status).toBe(400);
    expect((await get('/', 'POST')).status).toBe(405);
  });
});
