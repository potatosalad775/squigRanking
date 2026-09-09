// End-to-end wiring test: loads the real page shell and the built bundle into a
// DOM, serves it a fixture sheet and phonebook, and asserts what the operator
// would see. The config and sheet come from the default preset, which is what
// the build copies into dist/, so this exercises a real download.
// Run `npm run build` first; `npm run check` does that in order.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { before, describe, test } from 'node:test';
import { JSDOM } from 'jsdom';

const html = readFileSync('site/index.html', 'utf8');
const bundle = readFileSync('dist/core.js', 'utf8');
const config = readFileSync('presets/letter/ranking-config.js', 'utf8');
const template = readFileSync('presets/letter/TEMPLATE.csv', 'utf8');

const PHONEBOOK = JSON.stringify([
  { name: 'GrinEar', phones: [{ name: 'Reference', file: 'GrinEar Reference' }] },
]);

/** Boot the page with stubbed network responses and wait for the first render. */
async function bootPage(csv: string = template, configSource: string = config): Promise<JSDOM> {
  const dom = new JSDOM(html, {
    url: 'https://example.com/ranking/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  // jsdom has no layout engine, so give the deep-link path a scroll to call.
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};

  const requests: string[] = [];
  (window as unknown as { __requests: string[] }).__requests = requests;
  (window as unknown as { fetch: typeof fetch }).fetch = (async (input: string) => {
    const url = String(input);
    requests.push(url);
    const body = url.includes('phone_book') ? PHONEBOOK : csv;
    return {
      ok: true,
      status: 200,
      text: async () => body,
      json: async () => JSON.parse(body),
    } as Response;
  }) as typeof fetch;

  window.eval(configSource);
  window.eval(bundle);

  // Let the config load, the CSV promises settle, and the phonebook resolve.
  for (let i = 0; i < 10; i++) await new Promise(resolve => setTimeout(resolve, 0));
  return dom;
}

/**
 * The preset config with one top-level key replaced, written as the source text
 * `bootPage` evaluates. Patching the object after it is assigned beats editing
 * the preset's text, which would break the next time the preset is reformatted.
 */
function withChrome(override: string): string {
  return `${config}\nObject.assign(window.RANKING_CONFIG, { ${override} });`;
}

function cards(dom: JSDOM): HTMLElement[] {
  return [...dom.window.document.querySelectorAll<HTMLElement>('#device-card-list .device-card')];
}

function text(dom: JSDOM, selector: string): string {
  return dom.window.document.querySelector(selector)?.textContent?.trim() ?? '';
}

describe('page', () => {
  let dom: JSDOM;
  before(async () => {
    dom = await bootPage();
  });

  test('renders one card per sheet row', () => {
    assert.equal(cards(dom).length, 3);
  });

  test('cards are ordered best rank first', () => {
    const headers = cards(dom).map(card => card.querySelector('.device-card-header')?.textContent);
    assert.deepEqual(headers, ['GrinEar Reference', 'TrueEar Projekt Wen', 'LX Whatever']);
  });

  test('the rank badge takes its color from the scale', () => {
    const badge = cards(dom)[0]?.querySelector<HTMLElement>('.device-card-rank');
    assert.equal(badge?.textContent, 'S');
    // The scale's top step is #6c63ff; jsdom reports it as rgb().
    assert.equal(badge?.style.background, 'rgb(108, 99, 255)');
    assert.equal(badge?.style.color, 'rgb(255, 255, 255)');
  });

  test('the rank dropdown is built from the scale', async () => {
    const options = [...dom.window.document.querySelectorAll('#filter-input-rank option')]
      .map(option => option.textContent);
    assert.deepEqual(options?.slice(1, 4), ['S', 'A+', 'A']);
  });

  test('pros and cons render as separate blocks', () => {
    const first = cards(dom)[0]!;
    assert.ok(first.querySelector('.card-block-up')?.textContent?.includes('Even tonality'));
    assert.ok(first.querySelector('.card-block-down')?.textContent?.includes('Fit may be shallow'));
  });

  test('a multi-line cell keeps its line breaks', () => {
    const pros = cards(dom)[0]?.querySelector('.card-block-up');
    assert.equal(pros?.querySelectorAll('br').length, 1);
  });

  test('a blank cell renders no block at all', () => {
    const last = cards(dom)[2]!;
    assert.equal(last.querySelector('.card-block-up'), null);
  });

  test('tags render as individual pills', () => {
    const tags = [...cards(dom)[0]!.querySelectorAll('.card-tag')].map(tag => tag.textContent);
    assert.deepEqual(tags, ['Personal Collection', 'Reference']);
  });

  test('card ids follow the deep-link template', () => {
    assert.equal(cards(dom)[0]?.id, 'grinear-reference');
  });

  test('type toggles come from the config', () => {
    const labels = [...dom.window.document.querySelectorAll('.toggle-btn')].map(b => b.textContent);
    assert.deepEqual(labels, ['Earphones', 'Headphones']);
  });

  test('the measurement link resolves through the phonebook', () => {
    const link = cards(dom)[0]?.querySelector<HTMLAnchorElement>('.device-card-measurement');
    assert.equal(link?.hidden, false);
    assert.ok(link?.getAttribute('href')?.includes('GrinEar_Reference'));
  });

  test('an unmatched device hides its measurement link', () => {
    const link = cards(dom)[2]?.querySelector<HTMLAnchorElement>('.device-card-measurement');
    assert.equal(link?.hidden, true);
  });

  test('spreadsheet content is inserted as text, never as markup', async () => {
    const csv = 'Brand,Model,Rank,Comment\nEvil,"<img src=x onerror=alert(1)>",S,"<b>bold</b>"';
    const injected = await bootPage(csv);
    const card = cards(injected)[0]!;
    assert.equal(card.querySelectorAll('img, b:not(.card-block-label)').length, 0);
    assert.ok(card.textContent?.includes('<b>bold</b>'));
  });
});

describe('controls', () => {
  let dom: JSDOM;
  before(async () => {
    dom = await bootPage();
  });

  test('search narrows the list', () => {
    const input = dom.window.document.querySelector<HTMLInputElement>('#input-search')!;
    input.value = 'TrueEar';
    input.dispatchEvent(new dom.window.Event('input'));
    assert.equal(cards(dom).length, 1);
  });

  test('reset restores every row', () => {
    dom.window.document.querySelector<HTMLButtonElement>('#reset-filters-btn')!.click();
    assert.equal(cards(dom).length, 3);
  });

  test('the rank filter matches exactly', () => {
    const select = dom.window.document.querySelector<HTMLSelectElement>('#filter-input-rank')!;
    select.value = 'A';
    select.dispatchEvent(new dom.window.Event('change'));
    assert.equal(cards(dom).length, 1);
    dom.window.document.querySelector<HTMLButtonElement>('#reset-filters-btn')!.click();
  });

  test('an empty result set explains itself', () => {
    const input = dom.window.document.querySelector<HTMLInputElement>('#input-search')!;
    input.value = 'nothing matches this';
    input.dispatchEvent(new dom.window.Event('input'));
    assert.equal(cards(dom).length, 0);
    assert.ok(text(dom, '.list-empty').length > 0);
    input.value = '';
    input.dispatchEvent(new dom.window.Event('input'));
  });

  test('the sort dropdown reorders the list', () => {
    const select = dom.window.document.querySelector<HTMLSelectElement>('#select-sort')!;
    select.value = 'brand-asc';
    select.dispatchEvent(new dom.window.Event('change'));
    const brands = cards(dom).map(card => card.dataset['brand']);
    assert.deepEqual(brands, ['grinear', 'lx', 'trueear']);
  });

  test('the auto-built driver filter lists the sheet values', () => {
    const select = dom.window.document.querySelector<HTMLSelectElement>('#filter-input-driver')!;
    const options = [...select.options].map(option => option.value);
    assert.deepEqual(options, ['', 'Hybrid']);
  });

  test('the auto-built style filter lists the sheet values', () => {
    const select = dom.window.document.querySelector<HTMLSelectElement>('#filter-input-style')!;
    const options = [...select.options].map(option => option.value);
    assert.deepEqual(options, ['', 'IEM']);
  });
});

describe('language and chrome', () => {
  test('chrome strings come from the bundle, with no lang file fetched', async () => {
    const dom = await bootPage();
    const requests = (dom.window as unknown as { __requests: string[] }).__requests;
    assert.equal(requests.some(url => url.includes('lang/')), false);
    assert.equal(text(dom, '#stats-modal-title'), 'Ranking Statistics');
  });

  test('the header and footer are built from the config, not the markup', async () => {
    const dom = await bootPage();
    // The shell ships three empty landmarks; everything below comes from core.
    assert.ok(!html.includes('header-title'), 'index.html still carries header markup');
    assert.equal(text(dom, '.header-title'), 'SquigRanking');
    assert.ok(text(dom, '.footer-note').startsWith("The 'Ranking List'"));
    assert.ok(dom.window.document.getElementById('toggle-theme'), 'no theme toggle');
    assert.ok(dom.window.document.getElementById('open-stats-modal'), 'no stats button');
    assert.ok(dom.window.document.getElementById('scroll-to-top-btn'), 'no scroll-to-top button');
  });

  test('the footer note follows the language', async () => {
    const dom = await bootPage();
    dom.window.document.querySelector<HTMLButtonElement>('#toggle-language')!.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.ok(text(dom, '.footer-note').startsWith("'랭킹 리스트'"));
  });

  test('a single-language config hides the language toggle', async () => {
    const dom = await bootPage(template, withChrome("languages: ['en']"));
    assert.equal(dom.window.document.getElementById('toggle-language'), null);
    // The theme toggle is unaffected.
    assert.ok(dom.window.document.getElementById('toggle-theme'));
  });

  test('chrome options turn the built-in controls off', async () => {
    const dom = await bootPage(template, withChrome(
      'chrome: { title: false, themeToggle: false, measurementsLink: false }',
    ));
    assert.equal(text(dom, '.header-title'), '');
    assert.equal(dom.window.document.getElementById('toggle-theme'), null);
    assert.equal(dom.window.document.getElementById('link-measurements-page'), null);
  });

  test('footer links are rendered from the config', async () => {
    const dom = await bootPage(template, withChrome(
      "chrome: { footer: { links: [{ href: 'https://example.com', label: 'My site', newTab: true }] } }",
    ));
    const link = dom.window.document.querySelector<HTMLAnchorElement>('.footer-bottom a')!;
    assert.equal(link.textContent, 'My site');
    assert.equal(link.getAttribute('href'), 'https://example.com');
    assert.equal(link.target, '_blank');
  });

  test('a chrome config with nothing to say leaves no empty footer bar', async () => {
    const dom = await bootPage(template, withChrome('chrome: {}'));
    assert.equal(dom.window.document.querySelector<HTMLElement>('#ranking-footer')!.hidden, true);
  });

  test('the toggle switches every chrome string and card label to Korean', async () => {
    const dom = await bootPage();
    dom.window.document.querySelector<HTMLButtonElement>('#toggle-language')!.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(text(dom, '#stats-modal-title'), '랭킹 통계');
    assert.equal(text(dom, '#reset-filters-btn'), '필터 초기화');
    assert.equal(dom.window.document.querySelector('.toggle-btn')?.textContent, '이어폰');
    assert.equal(dom.window.document.documentElement.lang, 'ko');
  });

  test('Korean comment columns are read for Korean', async () => {
    const dom = await bootPage();
    dom.window.document.querySelector<HTMLButtonElement>('#toggle-language')!.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    const comment = cards(dom)[0]?.querySelector('.card-block-plain');
    assert.ok(comment?.textContent?.includes('레퍼런스'));
  });
});

describe('deep links and type switching', () => {
  /** Boot at a specific URL so `?type=` and `#slug` are read at startup. */
  async function bootAt(url: string, csv: string = template): Promise<JSDOM> {
    const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  // jsdom has no layout engine, so give the deep-link path a scroll to call.
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
    (dom.window as unknown as { fetch: typeof fetch }).fetch = (async (input: string) => {
      const body = String(input).includes('phone_book') ? PHONEBOOK : csv;
      return { ok: true, status: 200, text: async () => body, json: async () => JSON.parse(body) } as Response;
    }) as typeof fetch;
    dom.window.eval(config);
    dom.window.eval(bundle);
    for (let i = 0; i < 10; i++) await new Promise(resolve => setTimeout(resolve, 0));
    return dom;
  }

  test('?type= selects the matching tab', async () => {
    const dom = await bootAt('https://example.com/ranking/?type=headphone');
    const active = dom.window.document.querySelector('.toggle-btn.active');
    assert.equal(active?.getAttribute('data-type'), 'headphone');
  });

  test('an unknown ?type= falls back to the first type', async () => {
    const dom = await bootAt('https://example.com/ranking/?type=nonsense');
    const active = dom.window.document.querySelector('.toggle-btn.active');
    assert.equal(active?.getAttribute('data-type'), 'earphone');
  });

  test('a hash highlights the matching card', async () => {
    const dom = await bootAt('https://example.com/ranking/#grinear-reference');
    const card = dom.window.document.getElementById('grinear-reference');
    assert.ok(card?.classList.contains('hash-highlight'));
  });

  test('the headphone type applies its blank-cell defaults', async () => {
    // The template fills Style in, so blank it: an empty cell is what `defaults` covers.
    const csv = `Brand,Model,Rank,Score,Driver,Style
GrinEar,Reference,S,5,Hybrid,`;
    const dom = await bootAt('https://example.com/ranking/?type=headphone', csv);
    const chips = [...cards(dom)[0]!.querySelectorAll('.device-card-chip')].map(c => c.textContent);
    assert.ok(chips.includes('Open'), `expected an Open style chip, got ${chips.join(', ')}`);
  });

  test('clicking a type toggle swaps the list and the URL', async () => {
    const dom = await bootAt('https://example.com/ranking/');
    dom.window.document.querySelector<HTMLButtonElement>('#toggle-headphone')!.click();
    assert.ok(dom.window.location.search.includes('type=headphone'));
    assert.equal(dom.window.document.querySelector('.toggle-btn.active')?.id, 'toggle-headphone');
  });
});

describe('failure handling', () => {
  test('a failed sheet load shows an error instead of an empty page', async () => {
    const dom = new JSDOM(html, { url: 'https://example.com/ranking/', runScripts: 'outside-only' });
    (dom.window as unknown as { fetch: typeof fetch }).fetch = (async () => ({
      ok: false,
      status: 404,
      text: async () => '',
      json: async () => null,
    })) as unknown as typeof fetch;
    dom.window.eval(config);
    dom.window.eval(bundle);
    for (let i = 0; i < 10; i++) await new Promise(resolve => setTimeout(resolve, 0));
    assert.ok(text(dom, '.list-error').length > 0);
  });
});

describe('a pre-scale config', () => {
  // classMap and explicit filter values are how every deploy before scales was
  // written. They have to keep rendering exactly as they did.
  const legacy = (() => {
    const open = config.indexOf('scale: [');
    const close = config.indexOf('],', open) + 2;
    const replacement = [
      "filter: { kind: 'select', values: ['S', 'A', 'F'] },",
      "\t\t\trender: { kind: 'rank-badge', classMap: { S: 'rank-S', default: 'rank-F' } },",
    ].join('\n');
    const withClassMap = config.slice(0, open) + replacement + config.slice(close);
    return withClassMap
      .replace('configVersion: 3,', 'configVersion: 1,')
      // Drop the scale-era declarations the replacement above now duplicates.
      .replace("\n\t\t\tfilter: { kind: 'select' },", '')
      .replace("\n\t\t\trender: { kind: 'rank-badge' },", '');
  })();

  test('the legacy fixture builds', () => {
    assert.ok(legacy.includes('classMap'), 'classMap missing');
    assert.ok(!legacy.includes('scale: ['), 'scale not removed');
    assert.ok(!legacy.includes("render: { kind: 'rank-badge' },"), 'bare rank-badge left behind');
  });

  test('renders classMap classes and no inline color', async () => {
    const dom = await bootPage(template, legacy);
    const badge = cards(dom)[0]?.querySelector<HTMLElement>('.device-card-rank');
    assert.equal(badge?.textContent, 'S');
    assert.ok(badge?.classList.contains('rank-S'));
    assert.equal(badge?.style.background, '');
  });

  test('its filter values still populate the dropdown', async () => {
    const dom = await bootPage(template, legacy);
    const options = [...dom.window.document.querySelectorAll('#filter-input-rank option')]
      .map(option => option.textContent);
    assert.deepEqual(options.slice(1), ['S', 'A', 'F']);
  });
});
