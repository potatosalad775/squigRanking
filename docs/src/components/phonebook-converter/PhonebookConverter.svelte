<script lang="ts">
	// Your squig already knows every device you own. This turns that list into
	// the first two columns of a ranking sheet, so the only thing left to type is
	// the part a phone book cannot hold: the review.
	import DeviceList from './DeviceList.svelte';
	import { convert, duplicateNames, type Conversion, type ConvertOptions } from './convert.ts';
	import {
		EXTRA_COLUMNS, offScaleRanks, sheetGrid, sheetHeaders, toCsv, toTsv,
		type DeviceRow, type SheetOptions,
	} from './sheet.ts';
	import { DESCRIPTION_TARGETS, TEMPLATE_HEADERS } from './templates.ts';
	import { PRESETS, PRESET_LABELS, presetState } from '../config-editor/form.ts';

	// The parsed file, kept so a changed reading option can rebuild the list
	// without a second download. Deliberately not `$state`: nothing renders from
	// it, and proxying a few hundred brands to watch a value nobody mutates is
	// work for its own sake.
	let parsed: unknown = null;

	let url = $state('');
	let pasted = $state('');
	let showPaste = $state(false);
	let loading = $state(false);
	let loadError = $state('');
	let rebuilt = $state('');
	let copied = $state('');

	// How the file is read. Changing one of these rebuilds the list.
	let reading = $state<ConvertOptions>({
		splitVariations: false,
		rankFromReviewScore: true,
		zeroIsUnrated: true,
	});

	// How the sheet is written. These only change the export, so they stay live.
	let preset = $state('letter');
	let korean = $state(true);
	let descriptionInto = $state('');
	let price = $state(false);
	let reviewLink = $state(false);
	let shopLink = $state(false);

	let conversion = $state<Conversion | null>(null);
	let rows = $state<DeviceRow[]>([]);
	let edited = $state(false);

	const sheetOptions = $derived<SheetOptions>({
		template: TEMPLATE_HEADERS[preset] ?? TEMPLATE_HEADERS['letter']!,
		korean,
		descriptionInto,
		price,
		reviewLink,
		shopLink,
	});

	const chosen = $derived(rows.filter(row => row.include));
	const headers = $derived(sheetHeaders(sheetOptions));
	const grid = $derived(sheetGrid(chosen, sheetOptions));
	const csv = $derived(toCsv(grid));
	const scaleValues = $derived(presetState(preset).scale.map(entry => entry.value));
	const offScale = $derived(offScaleRanks(chosen, scaleValues));
	const duplicates = $derived(duplicateNames(chosen));
	const extraColumns = $derived(
		headers.filter(header => (Object.values(EXTRA_COLUMNS) as string[]).includes(header)),
	);

	function runConvert(): void {
		if (parsed === null) return;
		const result = convert(parsed, { ...reading });
		conversion = result;
		rows = result.devices.map(device => ({ ...device, include: true }));
		rebuilt = edited ? 'The list was rebuilt from the file, so your edits to it were reset.' : '';
		edited = false;
	}

	function load(text: string): void {
		loadError = '';
		let data: unknown;
		try {
			data = JSON.parse(text);
		} catch (error) {
			loadError = `That file is not valid JSON. ${(error as Error).message}`;
			return;
		}
		parsed = data;
		edited = false;
		rebuilt = '';
		runConvert();
	}

	async function fetchUrl(): Promise<void> {
		const target = (!/^https?:\/\//.test(url.trim()))
			? `https://${url.trim()}`
			: url.trim();
		if (!target) return;
		loading = true;
		loadError = '';
		try {
			const response = await fetch(target);
			if (!response.ok) throw new Error(`the server answered ${response.status}`);
			load(await response.text());
		} catch (error) {
			// Almost every squig serves its data folder with an open CORS policy, so
			// this is usually a typo — but a browser cannot tell a blocked read from
			// a missing file, so the message has to cover both.
			loadError =
				`Could not read that address (${(error as Error).message}). Check the URL, or ` +
				'download the file and load it from disk instead.';
		} finally {
			loading = false;
		}
	}

	async function pickFile(event: Event & { currentTarget: HTMLInputElement }): Promise<void> {
		const file = event.currentTarget.files?.[0];
		if (!file) return;
		load(await file.text());
		event.currentTarget.value = '';
	}

	function download(name: string, text: string, type: string): void {
		const href = URL.createObjectURL(new Blob([text], { type }));
		const anchor = document.createElement('a');
		anchor.href = href;
		anchor.download = name;
		document.body.appendChild(anchor);
		anchor.click();
		document.body.removeChild(anchor);
		URL.revokeObjectURL(href);
	}

	async function copy(label: string, text: string): Promise<void> {
		try {
			await navigator.clipboard.writeText(text);
			copied = label;
			setTimeout(() => (copied = ''), 2000);
		} catch {
			// Blocked in some embedded contexts. The preview below is always there
			// to select from by hand.
			copied = '';
		}
	}

	function setReading<K extends keyof ConvertOptions>(key: K, value: ConvertOptions[K]): void {
		reading[key] = value;
		runConvert();
	}

	function count(n: number, one: string, many: string): string {
		return `${n} ${n === 1 ? one : many}`;
	}

	function joinList(items: string[]): string {
		if (items.length < 2) return items.join('');
		return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
	}

	/** A capped list, so one bad phone book cannot fill the panel with names. */
	function firstFew(items: string[], limit: number): string {
		const shown = items.slice(0, limit).join(', ');
		return items.length > limit ? `${shown}, and ${items.length - limit} more` : shown;
	}
</script>

<div class="converter">
	<section class="panel">
		<h2>1. Load your phone_book.json</h2>
		<p class="note">
			The file that lists every brand and device on your measurement site. CrinGraph and
			modernGraphTool both keep it at <code>data/phone_book.json</code>, and both dialects are read
			here. Nothing is uploaded: the file is parsed in this tab.
		</p>

		<div class="load">
			<label class="field wide">
				<span>Address of your phone book</span>
				<input
					type="url"
					bind:value={url}
					placeholder="https://yoursquig.squig.link/data/phone_book.json"
					spellcheck="false"
					onkeydown={event => event.key === 'Enter' && fetchUrl()}
				/>
			</label>
			<div class="toolbar">
				<button type="button" class="primary" disabled={loading} onclick={fetchUrl}>
					{loading ? 'Fetching…' : 'Fetch it'}
				</button>
				<label class="filebutton">
					Choose a file
					<input type="file" accept=".json,application/json" onchange={pickFile} />
				</label>
				<button type="button" onclick={() => (showPaste = !showPaste)}>
					{showPaste ? 'Cancel paste' : 'Paste it instead'}
				</button>
			</div>
		</div>

		{#if showPaste}
			<div class="import">
				<label class="field wide">
					<span>Paste the contents of phone_book.json</span>
					<textarea bind:value={pasted} rows="8" spellcheck="false"></textarea>
				</label>
				<button type="button" class="primary" onclick={() => load(pasted)}>Read it</button>
			</div>
		{/if}

		{#if loadError}
			<div class="problems"><strong>{loadError}</strong></div>
		{/if}
	</section>

	{#if conversion}
		<section class="panel">
			<h2>2. Decide how it is read</h2>
			<p class="note">Changing any of these rebuilds the list below from the file.</p>

			<ul class="options">
				<li>
					<label class="toggle">
						<input
							type="checkbox"
							checked={reading.rankFromReviewScore}
							onchange={event => setReading('rankFromReviewScore', event.currentTarget.checked)}
						/>
						<span>
							<strong>Start from the review scores already in the file</strong> — a phone book's
							<code>reviewScore</code> becomes the row's Rank, which you can then edit.
						</span>
					</label>
				</li>
				{#if reading.rankFromReviewScore}
					<li class="nested">
						<label class="toggle">
							<input
								type="checkbox"
								checked={reading.zeroIsUnrated}
								onchange={event => setReading('zeroIsUnrated', event.currentTarget.checked)}
							/>
							<span>
								<strong>Treat a score of 0 as "not reviewed"</strong> — most CrinGraph deploys write
								<code>0</code> into every device they have not scored, rather than leaving it out.
							</span>
						</label>
					</li>
				{/if}
				<li>
					<label class="toggle">
						<input
							type="checkbox"
							checked={reading.splitVariations}
							onchange={event => setReading('splitVariations', event.currentTarget.checked)}
						/>
						<span>
							<strong>One row per measurement</strong> — a device measured with three eartips becomes
							three rows instead of one. Off by default: a card is normally one device.
						</span>
					</label>
				</li>
			</ul>

			<p class="summary">
				Read {conversion.brands} brands and {rows.length} devices, in a file written for
				{conversion.dialect === 'moderngraphtool' ? 'modernGraphTool' : 'CrinGraph'}.
			</p>

			{#if conversion.error}
				<div class="problems"><strong>{conversion.error}</strong></div>
			{/if}
			{#if conversion.notes.length}
				<div class="problems">
					<strong>Worth knowing</strong>
					<ul>
						{#each conversion.notes as note (note)}
							<li>{note}</li>
						{/each}
					</ul>
				</div>
			{/if}
			{#if rebuilt}
				<p class="note">{rebuilt}</p>
			{/if}
		</section>

		<section class="panel">
			<h2>3. Trim the list</h2>
			<p class="note">
				Uncheck anything that should not be in your sheet, and fix any name you would rather write
				differently. The page matches a row back to its measurement by brand and model, so a small
				edit is safe and a rewrite may not be.
			</p>
			<DeviceList bind:rows {scaleValues} onedit={() => (edited = true)} />
		</section>

		<section class="panel">
			<h2>4. Match your sheet's columns</h2>
			<div class="presets">
				{#each PRESETS as option (option)}
					<button
						type="button"
						class="preset"
						class:selected={preset === option}
						aria-pressed={preset === option}
						onclick={() => (preset = option)}
					>
						<strong>{PRESET_LABELS[option]!.title}</strong>
						<span>{PRESET_LABELS[option]!.blurb}</span>
					</button>
				{/each}
			</div>

			<label class="toggle spaced">
				<input type="checkbox" bind:checked={korean} />
				<span>Keep the <code>_KR</code> columns for a bilingual sheet</span>
			</label>

			<label class="field">
				<span>Put each device's description in</span>
				<select bind:value={descriptionInto}>
					<option value="">Nothing — leave descriptions behind</option>
					{#each DESCRIPTION_TARGETS as target (target)}
						<option value={target}>the {target} column</option>
					{/each}
				</select>
			</label>

			<p class="note spaced">
				Add a column for what the template has no home for. Each one needs a matching entry in
				<code>columns</code> in your config before the page will show it — see
				<a href="/squigRanking/docs/setup/your-sheet/#adding-a-column">adding a column</a>.
			</p>
			<div class="options inline">
				<label class="toggle">
					<input type="checkbox" bind:checked={price} />
					<span>Price</span>
				</label>
				<label class="toggle">
					<input type="checkbox" bind:checked={reviewLink} />
					<span>Review link</span>
				</label>
				<label class="toggle">
					<input type="checkbox" bind:checked={shopLink} />
					<span>Shop link</span>
				</label>
			</div>
		</section>

		<section class="panel">
			<h2>5. Take the rows</h2>

			{#if !chosen.length}
				<div class="problems"><strong>Every device is unchecked, so the sheet would be empty.</strong></div>
			{/if}
			{#if duplicates.length}
				<div class="problems">
					<strong>{count(duplicates.length, 'name appears', 'names appear')} more than once</strong>
					<p>
						Cards are anchored by <code>brand-model</code>, so a repeated name means one link for two
						devices. Rename or uncheck one of each: {firstFew(duplicates, 6)}.
					</p>
				</div>
			{/if}
			{#if offScale.length}
				<div class="problems">
					<strong>
						{count(offScale.length, 'rank value is', 'rank values are')} not on the
						{PRESET_LABELS[preset]!.title.toLowerCase()} scale
					</strong>
					<p>
						{firstFew(offScale, 8)}. Either pick the rank style that matches, or edit those cells. A
						CrinGraph <code>reviewScore</code> is usually 0–5, which is the five-star scale.
					</p>
				</div>
			{/if}

			<p class="note">
				{chosen.length} rows under this header:
				<code class="headers">{headers.join(', ')}</code>
			</p>

			<div class="toolbar">
				<button
					type="button"
					class="primary"
					onclick={() => download('ranking-rows.csv', csv, 'text/csv')}
				>
					Download ranking-rows.csv
				</button>
				<button type="button" onclick={() => copy('rows', toTsv(grid.slice(1)))}>
					{copied === 'rows' ? 'Copied' : 'Copy the rows'}
				</button>
				<button type="button" onclick={() => copy('all', toTsv(grid))}>
					{copied === 'all' ? 'Copied' : 'Copy with the header'}
				</button>
			</div>

			<p class="note">
				<strong>Into the workbook:</strong> open <code>TEMPLATE.xlsx</code>, click cell
				<code>A2</code> of the <em>List</em> tab, and use <em>Copy the rows</em> above. The example
				rows are overwritten, which is what you want.
				{#if headers.includes('Score')}
					Its Score column is a formula, so drag one surviving cell back down the column afterwards.
				{/if}
				{#if extraColumns.length}
					{joinList(extraColumns)}
					{extraColumns.length === 1 ? 'arrives' : 'arrive'} after the template's own columns, and the
					workbook has no header for {extraColumns.length === 1 ? 'it' : 'them'}, so add one.
				{/if}
			</p>
			<p class="note">
				<strong>Into a bare sheet:</strong> take the CSV and use <em>File → Import</em>, or
				<em>Copy with the header</em> into cell <code>A1</code>.
			</p>

			<textarea class="output" readonly spellcheck="false" aria-label="The generated CSV">{csv}</textarea>
		</section>
	{/if}
</div>

<style>
	.converter {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.panel {
		border: 1px solid var(--sl-color-gray-5);
		border-radius: 0.6rem;
		padding: 1rem;
	}
	.panel h2 {
		margin: 0 0 0.75rem;
		font-size: 1.05rem;
	}
	.presets {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		gap: 0.6rem;
	}
	.preset {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		text-align: left;
		padding: 0.7rem;
	}
	.preset span {
		font-size: 0.8rem;
		color: var(--sl-color-gray-2);
	}
	.preset.selected {
		border-color: var(--sl-color-accent);
		outline: 1px solid var(--sl-color-accent);
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		font-size: 0.75rem;
		color: var(--sl-color-gray-2);
		flex: 1 1 10rem;
	}
	.field.wide {
		flex: 1 1 100%;
	}
	.field input,
	.field select,
	textarea {
		width: 100%;
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--sl-color-gray-5);
		border-radius: 0.35rem;
		background: var(--sl-color-black);
		color: var(--sl-color-white);
		font: inherit;
		font-size: 0.875rem;
	}
	.field select {
		max-width: 24rem;
	}
	textarea {
		font-family: var(--sl-font-mono, monospace);
		font-size: 0.78rem;
		line-height: 1.5;
		resize: vertical;
	}
	.output {
		margin-top: 0.9rem;
		min-height: 18rem;
		white-space: pre;
	}
	.load {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.toggle {
		display: flex;
		align-items: flex-start;
		gap: 0.45rem;
		font-size: 0.875rem;
		cursor: pointer;
	}
	.toggle input {
		margin-top: 0.25rem;
	}
	.toggle.spaced {
		margin: 0.9rem 0;
	}
	.options {
		list-style: none;
		margin: 0.75rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.options.inline {
		flex-direction: row;
		flex-wrap: wrap;
		gap: 1rem;
	}
	.options .nested {
		padding-left: 1.6rem;
	}
	.summary {
		margin: 0.9rem 0 0;
		font-size: 0.9rem;
	}
	.note {
		margin: 0.6rem 0 0;
		font-size: 0.8rem;
		color: var(--sl-color-gray-2);
	}
	.note.spaced {
		margin-top: 1rem;
	}
	.headers {
		display: block;
		margin-top: 0.3rem;
		word-break: break-word;
	}
	.problems {
		margin: 0.75rem 0;
		padding: 0.65rem 0.8rem;
		border-radius: 0.45rem;
		border: 1px solid var(--sl-color-orange);
		background: var(--sl-color-orange-low);
		font-size: 0.85rem;
	}
	.problems ul {
		margin: 0.35rem 0 0;
		padding-left: 1.1rem;
	}
	.problems p {
		margin: 0.35rem 0 0;
	}
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.9rem;
	}
	.import {
		margin-top: 0.9rem;
	}
	button,
	.filebutton {
		display: inline-flex;
		align-items: center;
		padding: 0.45rem 0.8rem;
		border: 1px solid var(--sl-color-gray-5);
		border-radius: 0.4rem;
		background: var(--sl-color-black);
		color: var(--sl-color-white);
		font: inherit;
		font-size: 0.875rem;
		cursor: pointer;
	}
	button:hover,
	.filebutton:hover {
		background: var(--sl-color-gray-6);
	}
	/* The file input is off-screen, so the label has to show its focus ring. */
	.filebutton:focus-within {
		outline: 2px solid var(--sl-color-accent);
		outline-offset: 2px;
	}
	button:disabled {
		opacity: 0.6;
		cursor: progress;
	}
	button.primary {
		background: var(--sl-color-accent);
		border-color: var(--sl-color-accent);
		color: var(--sl-color-black);
		font-weight: 600;
	}
	.filebutton input {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
</style>
