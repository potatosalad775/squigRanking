/**
 * squigRanking CDN loader
 *
 * Resolves which build of the ranking page to run, then injects its stylesheet
 * and bundle. Site operators load this instead of hard-coding a version, so bug
 * fixes arrive without them touching a file.
 *
 * Which build it loads follows from where this file itself was loaded from, so
 * neither mode costs a probe. index.html asks for a neighbouring loader.js and
 * falls back to the CDN copy when there is none:
 *
 *   loader.js served from the page's own origin  → core.min.js and style.css
 *     are read from the same folder. A release zip or `npm run build` output
 *     runs entirely from disk, with no request to the CDN at all.
 *   loader.js served from the CDN  → the version is resolved from versions.json
 *     and the build is pulled from jsDelivr. This is the two-file deploy:
 *     index.html and ranking-config.js, nothing to update by hand.
 *
 * Everything is configured from `window.RANKING_CONFIG.cdn`, all keys optional:
 *
 *   source        'auto' (default, as described above) | 'local' | 'cdn'. Set it
 *                 to override where the assets come from — 'cdn' when you keep a
 *                 local loader.js but still want the published build, 'local'
 *                 when you host the build but load this file from the CDN.
 *   version       Exact version to load, e.g. '1.2.3'. Skips versions.json.
 *   majorVersion  Major to track, e.g. 1. Defaults to the highest published.
 *   base          CDN base URL. Defaults to the jsDelivr URL below.
 *   versionsUrl   Full URL to versions.json. Defaults to the raw.githubusercontent
 *                 equivalent of `base`, because jsDelivr caches this file for
 *                 hours and it is the one file that must not be stale.
 *   debug         true loads the readable core.js instead of core.min.js.
 *
 * Stable URL:
 *   https://cdn.jsdelivr.net/gh/potatosalad775/squigRanking@cdn/loader.js
 */
(async function () {
	'use strict';

	const CDN_BASE_DEFAULT = 'https://cdn.jsdelivr.net/gh/potatosalad775/squigRanking@cdn';
	const TIMEOUT_MS = 15000;

	// Read before any await: currentScript is only set while this script runs.
	const selfUrl = (document.currentScript && document.currentScript.src) || '';

	// Tells the bootstrapper in index.html that a loader really did run, so it
	// can fall back when a host answers a missing loader.js with an HTML page.
	if (window.__squigRankingLoader) return;
	window.__squigRankingLoader = true;

	const cfg = (window.RANKING_CONFIG && window.RANKING_CONFIG.cdn) || {};
	const cdnBase = String(cfg.base || CDN_BASE_DEFAULT).replace(/\/+$/, '');
	const coreFile = cfg.debug ? 'core.js' : 'core.min.js';

	// Resolve against the document, not this script: in CDN mode the script's own
	// URL is jsDelivr, and "next to index.html" is what we actually mean.
	const localBase = new URL('.', document.baseURI).href;

	// A loader served from the page's own origin means the operator copied the
	// whole bundle, so the build sits next to it. One served from anywhere else
	// is the CDN copy, and the build has to be fetched.
	const source = cfg.source || (isSameOrigin(selfUrl) ? 'local' : 'cdn');

	// resolveCdnBase returns null once it has already reported the failure.
	const assetBase = source === 'local' ? localBase : await resolveCdnBase();
	if (assetBase) inject(assetBase);

	// ---------------- Version resolution ----------------

	/** The versioned CDN folder to load from, or null once an error is shown. */
	async function resolveCdnBase() {
		if (cfg.version) return `${cdnBase}/v${cfg.version}/`;

		let versions;
		try {
			versions = await fetchVersions();
		} catch (err) {
			showError(
				'Could not check for the latest version.',
				err.message,
				'Pin a version with RANKING_CONFIG.cdn.version, or host core.min.js yourself.',
			);
			return null;
		}

		let version;
		if (cfg.majorVersion != null) {
			version = versions[String(cfg.majorVersion)];
			if (!version) {
				showError(
					`No build published for major version ${cfg.majorVersion}.`,
					`Available: ${Object.keys(versions).join(', ') || 'none'}.`,
					'Check RANKING_CONFIG.cdn.majorVersion.',
				);
				return null;
			}
		} else {
			const majors = Object.keys(versions)
				.map(Number)
				.filter(n => !Number.isNaN(n))
				.sort((a, b) => b - a);
			if (!majors.length) {
				showError('No versions are published on the CDN.', 'versions.json is empty.');
				return null;
			}
			version = versions[String(majors[0])];
		}

		return `${cdnBase}/v${version}/`;
	}

	/**
	 * versions.json from GitHub raw, falling back to jsDelivr.
	 *
	 * jsDelivr edge-caches for hours, which for this one file means a release can
	 * sit invisible for most of a day. Raw GitHub is uncached but goes down more
	 * often, so a stale map still beats a blank page — hence the fallback. A 4xx
	 * is a misconfiguration, not an outage, so it is not retried.
	 */
	async function fetchVersions() {
		const primary = cfg.versionsUrl || rawGitHubUrl(cdnBase) || `${cdnBase}/versions.json`;
		const fallback = `${cdnBase}/versions.json`;

		try {
			return await getJson(primary);
		} catch (err) {
			if (primary === fallback || /HTTP 4\d\d/.test(err.message)) throw err;
			try {
				return await getJson(fallback);
			} catch (fallbackErr) {
				throw new Error(`${err.message}; fallback failed: ${fallbackErr.message}`);
			}
		}
	}

	/**
	 * Translate a jsDelivr gh/ base into the raw.githubusercontent equivalent.
	 * Returns null for anything else, e.g. an operator serving their own mirror.
	 */
	function rawGitHubUrl(base) {
		const match = base.match(/^https:\/\/cdn\.jsdelivr\.net\/gh\/([^/]+)\/([^/@]+)@([^/]+)\/?$/);
		if (!match) return null;
		const [, owner, repo, ref] = match;
		return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/versions.json`;
	}

	// ---------------- Local bundle detection ----------------

	/**
	 * Was this loader served by the page's own site rather than the CDN?
	 *
	 * An empty src means an inline script, which only happens if someone pasted
	 * this file into their page — that is as self-hosted as it gets.
	 */
	function isSameOrigin(url) {
		if (!url) return true;
		try {
			return new URL(url, document.baseURI).origin === window.location.origin;
		} catch {
			return false;
		}
	}

	// ---------------- Injection ----------------

	/**
	 * Stylesheet first, then the bundle. Both start downloading right away, so
	 * neither waits on the other, and the stylesheet gets a head start on the
	 * larger file. Browsers also hold script execution while a stylesheet is
	 * pending, which in practice is what keeps core from rendering into an
	 * unstyled page — cheaper than awaiting the load event to guarantee it.
	 */
	function inject(base) {
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = new URL('style.css', base).href;
		document.head.appendChild(link);

		const script = document.createElement('script');
		script.src = new URL(coreFile, base).href;
		script.onerror = () =>
			showError(
				'Could not load the ranking page.',
				`Failed to fetch ${script.src}`,
				'Check your connection, or host core.min.js alongside index.html.',
			);
		document.head.appendChild(script);
	}

	// ---------------- Helpers ----------------

	/** fetch that gives up rather than leaving the page blank on a hung network. */
	function fetchWithTimeout(url, options) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
		return fetch(url, { ...options, signal: controller.signal }).finally(() =>
			clearTimeout(timer),
		);
	}

	async function getJson(url) {
		// Cache-bust: the whole point of this file is that it is never stale.
		const res = await fetchWithTimeout(`${url}?t=${Date.now()}`);
		if (!res.ok) throw new Error(`${url.split('/').pop().split('?')[0]}: HTTP ${res.status}`);
		return res.json();
	}

	function showError(title, detail, hint) {
		const target = document.getElementById('ranking-content') || document.body;
		const box = document.createElement('div');
		box.setAttribute(
			'style',
			'max-width:32rem;margin:4rem auto;padding:0 1.5rem;text-align:center;' +
				'font-family:system-ui,-apple-system,sans-serif;color:#222;',
		);

		const heading = document.createElement('h1');
		heading.setAttribute('style', 'font-size:1.125rem;font-weight:600;margin:0 0 .75rem;');
		heading.textContent = title;
		box.appendChild(heading);

		for (const line of [detail, hint]) {
			if (!line) continue;
			const paragraph = document.createElement('p');
			paragraph.setAttribute('style', 'font-size:.875rem;color:#666;margin:0 0 .5rem;');
			paragraph.textContent = line;
			box.appendChild(paragraph);
		}

		target.replaceChildren(box);
		console.error(`[squigRanking] ${title} ${detail || ''}`);
	}
})();
