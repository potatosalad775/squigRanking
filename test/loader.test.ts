// The loader decides which build every deployed page runs, and it is the one
// piece of this project that ships to operators without a build step checking
// it. So these tests run the real cdn/loader.js in a DOM and assert on what it
// injects — the URLs here are what a live page would actually request.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { JSDOM } from 'jsdom';

const loader = readFileSync('cdn/loader.js', 'utf8');

const PAGE = '<!DOCTYPE html><html><head></head><body><main id="ranking-content"></main></body></html>';
const PAGE_URL = 'https://example.com/ranking/';
const CDN = 'https://cdn.jsdelivr.net/gh/potatosalad775/squigRanking@cdn';

interface Run {
  dom: JSDOM;
  /** Every URL the loader fetched, in order, minus the cache-busting suffix. */
  requests: string[];
  /** src of the injected bundle, or null if none was injected. */
  script: string | null;
  /** href of the injected stylesheet, or null if none was injected. */
  style: string | null;
  /** Text of the in-page error, or null when the loader got as far as injecting. */
  error: string | null;
}

interface Options {
  /** `window.RANKING_CONFIG.cdn`, as an operator would write it. */
  cdn?: Record<string, unknown>;
  /** Where the loader itself was served from. Undefined means no currentScript. */
  from?: string;
  /** versions.json body, or a status number to fail the request with. */
  versions?: Record<string, string> | number;
}

/** Boot the real loader against a stubbed network and report what it did. */
async function run({ cdn, from, versions = { '1': '1.4.2' } }: Options = {}): Promise<Run> {
  const dom = new JSDOM(PAGE, { url: PAGE_URL, runScripts: 'outside-only' });
  const { window } = dom;

  const requests: string[] = [];
  (window as unknown as { fetch: unknown }).fetch = async (input: string) => {
    requests.push(String(input).replace(/[?&]t=\d+$/, ''));
    if (typeof versions === 'number') {
      return { ok: false, status: versions, json: async () => ({}) };
    }
    return { ok: true, status: 200, json: async () => versions };
  };

  // currentScript is how the loader tells a self-hosted copy of itself from the
  // CDN one, and jsdom cannot run an injected script to set it for real.
  Object.defineProperty(window.Document.prototype, 'currentScript', {
    configurable: true,
    get: () => (from === undefined ? null : { src: from }),
  });

  if (cdn) (window as unknown as { RANKING_CONFIG: unknown }).RANKING_CONFIG = { cdn };

  window.eval(loader);
  // Version resolution is two awaits deep; give the microtasks room to drain.
  for (let i = 0; i < 10; i++) await new Promise(resolve => setTimeout(resolve, 0));

  const { document } = window;
  const script = document.querySelector<HTMLScriptElement>('head script[src]');
  const style = document.querySelector<HTMLLinkElement>('head link[rel="stylesheet"]');
  const error = document.querySelector('#ranking-content h1');

  return {
    dom,
    requests,
    script: script ? script.src : null,
    style: style ? style.href : null,
    error: error ? error.textContent : null,
  };
}

describe('choosing between the CDN and a local build', () => {
  test('a loader served from the CDN pulls the published build', async () => {
    const result = await run({ from: `${CDN}/loader.js` });
    assert.equal(result.script, `${CDN}/v1.4.2/core.min.js`);
    assert.equal(result.style, `${CDN}/v1.4.2/style.css`);
  });

  test('a loader served by the page itself runs the build next to it', async () => {
    const result = await run({ from: `${PAGE_URL}loader.js` });
    assert.equal(result.script, `${PAGE_URL}core.min.js`);
    assert.equal(result.style, `${PAGE_URL}style.css`);
  });

  test('a self-hosted page never reaches the network', async () => {
    // This is the whole promise of the self-hosted mode: it works offline.
    const result = await run({ from: `${PAGE_URL}loader.js` });
    assert.deepEqual(result.requests, []);
  });

  test('a loader pasted inline counts as self-hosted', async () => {
    const result = await run({ from: undefined });
    assert.equal(result.script, `${PAGE_URL}core.min.js`);
    assert.deepEqual(result.requests, []);
  });

  test('source: cdn overrides a local loader', async () => {
    const result = await run({ from: `${PAGE_URL}loader.js`, cdn: { source: 'cdn' } });
    assert.equal(result.script, `${CDN}/v1.4.2/core.min.js`);
  });

  test('source: local overrides a CDN loader', async () => {
    const result = await run({ from: `${CDN}/loader.js`, cdn: { source: 'local' } });
    assert.equal(result.script, `${PAGE_URL}core.min.js`);
    assert.deepEqual(result.requests, []);
  });
});

describe('resolving a version', () => {
  test('the highest major wins when nothing is pinned', async () => {
    const result = await run({
      from: `${CDN}/loader.js`,
      // Out of order and double-digit, so a string sort would pick wrong.
      versions: { '2': '2.0.1', '10': '10.0.0', '1': '1.4.2' },
    });
    assert.equal(result.script, `${CDN}/v10.0.0/core.min.js`);
  });

  test('majorVersion pins a major and still takes its newest patch', async () => {
    const result = await run({
      from: `${CDN}/loader.js`,
      cdn: { majorVersion: 1 },
      versions: { '1': '1.4.2', '2': '2.0.1' },
    });
    assert.equal(result.script, `${CDN}/v1.4.2/core.min.js`);
  });

  test('an exact version skips the lookup entirely', async () => {
    const result = await run({ from: `${CDN}/loader.js`, cdn: { version: '1.2.3' } });
    assert.equal(result.script, `${CDN}/v1.2.3/core.min.js`);
    assert.deepEqual(result.requests, []);
  });

  test('versions.json is read from raw GitHub, not from the CDN', async () => {
    // jsDelivr caches for hours, so the one file that must be current is not
    // fetched through it. Getting this wrong hides a release for most of a day.
    const result = await run({ from: `${CDN}/loader.js` });
    assert.deepEqual(result.requests, [
      'https://raw.githubusercontent.com/potatosalad775/squigRanking/cdn/versions.json',
    ]);
  });

  test('a custom base is used verbatim, with no GitHub fallback invented', async () => {
    const base = 'https://cdn.example.com/ranking';
    const result = await run({ from: `${CDN}/loader.js`, cdn: { base } });
    assert.deepEqual(result.requests, [`${base}/versions.json`]);
    assert.equal(result.script, `${base}/v1.4.2/core.min.js`);
  });

  test('debug loads the readable build', async () => {
    const result = await run({ from: `${CDN}/loader.js`, cdn: { debug: true } });
    assert.equal(result.script, `${CDN}/v1.4.2/core.js`);
  });
});

describe('failing visibly', () => {
  test('an unreachable version map explains itself instead of blanking', async () => {
    const result = await run({ from: `${CDN}/loader.js`, versions: 500 });
    assert.equal(result.script, null);
    assert.match(result.error ?? '', /Could not check for the latest version/);
  });

  test('a 5xx retries through jsDelivr before giving up', async () => {
    const result = await run({ from: `${CDN}/loader.js`, versions: 500 });
    assert.deepEqual(result.requests, [
      'https://raw.githubusercontent.com/potatosalad775/squigRanking/cdn/versions.json',
      `${CDN}/versions.json`,
    ]);
  });

  test('a 404 is a misconfiguration, so it is not retried', async () => {
    const result = await run({ from: `${CDN}/loader.js`, versions: 404 });
    assert.equal(result.requests.length, 1);
    assert.match(result.error ?? '', /Could not check for the latest version/);
  });

  test('a major with no published build names the ones that exist', async () => {
    const result = await run({
      from: `${CDN}/loader.js`,
      cdn: { majorVersion: 9 },
      versions: { '1': '1.4.2' },
    });
    assert.equal(result.script, null);
    assert.match(result.error ?? '', /No build published for major version 9/);
  });

  test('an empty version map is reported rather than guessed at', async () => {
    const result = await run({ from: `${CDN}/loader.js`, versions: {} });
    assert.equal(result.script, null);
    assert.match(result.error ?? '', /No versions are published/);
  });
});

describe('the page shell agrees with the loader', () => {
  const html = readFileSync('site/index.html', 'utf8');

  test('config is loaded before the loader, and not deferred', async () => {
    // The loader reads RANKING_CONFIG.cdn synchronously. Deferring the config
    // would let an injected loader win the race and silently ignore every
    // pinned version, which no test of the loader alone would catch.
    assert.match(html, /<script src="ranking-config\.js"><\/script>/);
    assert.doesNotMatch(html, /defer[^>]*ranking-config\.js/);
  });

  test('the shell tries a local loader before the CDN one', async () => {
    assert.ok(html.includes("local.src = 'loader.js'"), 'no local loader attempt');
    assert.ok(html.includes(`${CDN}/loader.js`), 'no CDN fallback');
  });

  test('the shell links no build of its own, so nothing in it goes stale', async () => {
    // Every asset the loader owns has to stay unnamed here. A leftover tag for
    // one of them would keep working in a self-hosted folder and 404 on a CDN
    // deploy, or worse, pair a stale stylesheet with a fresh core.
    assert.doesNotMatch(html, /src="[^"]*core(\.min)?\.js"/);
    assert.doesNotMatch(html, /href="[^"]*style\.css"/);
    assert.doesNotMatch(html, /@cdn\/v\d/);
  });
});
