<script lang="ts">
	import LanguageEditor from './LanguageEditor.svelte';
	import ScaleEditor from './ScaleEditor.svelte';
	import { generateConfig, generateTemplateHeaders } from './generate.ts';
	import { parseConfig } from './parse.ts';
	import { PRESETS, PRESET_LABELS, presetState, validate, type FormState } from './form.ts';

	// One editor per page, so plain component state rather than a shared store.
	let form = $state<FormState>(presetState('letter'));
	let importText = $state('');
	let importError = $state('');
	let importWarnings = $state<string[]>([]);
	let showImport = $state(false);
	let copied = $state(false);

	let output = $derived(generateConfig(form));
	let problems = $derived(validate(form));
	let headers = $derived(generateTemplateHeaders(form));

	function choosePreset(preset: string) {
		form = presetState(preset);
		importWarnings = [];
		importError = '';
	}

	function applyImport() {
		const result = parseConfig(importText);
		importError = result.error ?? '';
		importWarnings = result.warnings;
		if (result.form) {
			form = result.form;
			showImport = false;
		}
	}

	async function copyOutput() {
		try {
			await navigator.clipboard.writeText(output);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// Clipboard access is blocked in some embedded contexts. The textarea
			// below is always there to select from by hand.
			copied = false;
		}
	}

	function download(name: string, text: string, type: string) {
		const url = URL.createObjectURL(new Blob([text], { type }));
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = name;
		document.body.appendChild(anchor);
		anchor.click();
		document.body.removeChild(anchor);
		URL.revokeObjectURL(url);
	}
</script>

<div class="editor">
	<section class="panel">
		<h2>1. Pick a rank style</h2>
		<div class="presets">
			{#each PRESETS as preset (preset)}
				<button
					type="button"
					class="preset"
					class:selected={form.preset === preset}
					aria-pressed={form.preset === preset}
					onclick={() => choosePreset(preset)}
				>
					<strong>{PRESET_LABELS[preset]!.title}</strong>
					<span>{PRESET_LABELS[preset]!.blurb}</span>
				</button>
			{/each}
		</div>
		{#if form.preset === 'custom'}
			<p class="note">Edited from a preset. Pick one above to start over.</p>
		{/if}

		<div class="options">
			<label class="field">
				<span>What the column is called</span>
				<input type="text" bind:value={form.rankLabelEn} />
			</label>
			{#if form.badge === 'stars'}
				<label class="field narrow">
					<span>Stars</span>
					<input type="number" min="1" max="10" bind:value={form.starsMax} />
				</label>
			{/if}
			{#if form.badge === 'score-badge'}
				<label class="field narrow">
					<span>Lowest</span>
					<input type="number" bind:value={form.scoreMin} />
				</label>
				<label class="field narrow">
					<span>Highest</span>
					<input type="number" bind:value={form.scoreMax} />
				</label>
				<label class="field narrow">
					<span>Decimals</span>
					<input type="number" min="0" max="3" bind:value={form.scoreDecimals} />
				</label>
			{/if}
		</div>
	</section>

	<section class="panel">
		<h2>2. Set the grades</h2>
		<ScaleEditor bind:form />
	</section>

	<section class="panel">
		<h2>3. Point it at your sheet</h2>
		{#each form.types as type, index (type.id)}
			<div class="type">
				<label class="toggle">
					<input type="checkbox" bind:checked={form.types[index]!.enabled} />
					<span>{type.labelEn}</span>
				</label>
				{#if type.enabled}
					<label class="field wide">
						<span>Published CSV URL</span>
						<input
							type="url"
							bind:value={form.types[index]!.url}
							placeholder="https://docs.google.com/.../pub?output=csv"
							spellcheck="false"
						/>
					</label>
					<div class="options">
						<label class="field">
							<span>Phonebook path</span>
							<input type="text" bind:value={form.types[index]!.phonebook} spellcheck="false" />
						</label>
						<label class="field">
							<span>Measurement link</span>
							<input type="text" bind:value={form.types[index]!.measurementUrl} spellcheck="false" />
						</label>
					</div>
				{/if}
			</div>
		{/each}
		<p class="note">
			The URL comes from File → Share → Publish to web, with the format set to comma-separated
			values. One sheet can serve both types.
		</p>
	</section>

	<section class="panel">
		<h2>4. Choose your columns</h2>
		<ul class="columns">
			{#each form.columns as column, index (column.id)}
				<li>
					<label class="toggle">
						<input type="checkbox" bind:checked={form.columns[index]!.enabled} />
						<span><strong>{column.header}</strong> — {column.hint}</span>
					</label>
				</li>
			{/each}
		</ul>
		<p class="note">
			Each text block gets a parallel column per language you add in step 6, so
			<code>Comment</code> is joined by <code>Comment_KR</code> and any other you set up there.
		</p>
	</section>

	<section class="panel">
		<h2>5. Name your page</h2>
		<label class="field wide">
			<span>Header title</span>
			<input type="text" bind:value={form.siteTitle} placeholder="Leave blank for no title" />
		</label>
		<label class="field wide">
			<span>Footer note</span>
			<textarea rows="2" bind:value={form.footerNoteEn}></textarea>
		</label>
		<div class="options">
			<label class="field">
				<span>Footer link text</span>
				<input type="text" bind:value={form.footerLinkLabel} placeholder="My measurements" />
			</label>
			<label class="field">
				<span>Footer link URL</span>
				<input type="url" bind:value={form.footerLinkUrl} spellcheck="false" placeholder="https://" />
			</label>
		</div>
		<p class="note">
			These go in the config, not in <code>index.html</code>. That file is three empty landmarks
			the page fills in, so this is the only place the wording lives.
		</p>
	</section>

	<section class="panel">
		<h2>6. Write it in more than one language</h2>
		<LanguageEditor bind:form />
	</section>

	<section class="panel">
		<h2>7. Take the file</h2>

		{#if problems.length}
			<div class="problems" role="status">
				<strong>Worth fixing first</strong>
				<ul>
					{#each problems as problem (problem)}
						<li>{problem}</li>
					{/each}
				</ul>
			</div>
		{/if}

		<p class="note">
			Your sheet's header row should read:
			<code class="headers">{headers.join(', ')}</code>
		</p>

		<div class="toolbar">
			<button
				type="button"
				class="primary"
				onclick={() => download('ranking-config.js', output, 'application/javascript')}
			>
				Download ranking-config.js
			</button>
			<button type="button" onclick={copyOutput}>{copied ? 'Copied' : 'Copy to clipboard'}</button>
			<button
				type="button"
				onclick={() => download('TEMPLATE.csv', `${headers.join(',')}\n`, 'text/csv')}
			>
				Download a blank sheet
			</button>
			<button type="button" onclick={() => (showImport = !showImport)}>
				{showImport ? 'Cancel import' : 'Import an existing config'}
			</button>
		</div>

		{#if showImport}
			<div class="import">
				<label class="field wide">
					<span>Paste your current ranking-config.js</span>
					<textarea bind:value={importText} rows="8" spellcheck="false"></textarea>
				</label>
				<button type="button" class="primary" onclick={applyImport}>Load it into the form</button>
				<p class="note">
					The file runs in your browser and never leaves it. Custom columns and unknown device types
					cannot be represented in this form, and are reported rather than dropped quietly.
				</p>
				{#if importError}
					<div class="problems"><strong>{importError}</strong></div>
				{/if}
			</div>
		{/if}

		{#if importWarnings.length}
			<div class="problems">
				<strong>Imported, with notes</strong>
				<ul>
					{#each importWarnings as warning (warning)}
						<li>{warning}</li>
					{/each}
				</ul>
			</div>
		{/if}

		<textarea class="output" readonly spellcheck="false" aria-label="Generated ranking-config.js"
			>{output}</textarea
		>
	</section>
</div>

<style>
	.editor {
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
		border: 1px solid var(--sl-color-gray-5);
		border-radius: 0.5rem;
		background: var(--sl-color-black);
		color: var(--sl-color-white);
		font: inherit;
		cursor: pointer;
	}
	.preset span {
		font-size: 0.8rem;
		color: var(--sl-color-gray-2);
	}
	.preset.selected {
		border-color: var(--sl-color-accent);
		outline: 1px solid var(--sl-color-accent);
	}
	.options {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin-top: 0.75rem;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		font-size: 0.75rem;
		color: var(--sl-color-gray-2);
		flex: 1 1 10rem;
	}
	.field.narrow {
		flex: 0 1 6rem;
	}
	.field.wide {
		flex: 1 1 100%;
		margin-top: 0.6rem;
	}
	.field input,
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
	textarea {
		font-family: var(--sl-font-mono, monospace);
		font-size: 0.78rem;
		line-height: 1.5;
		resize: vertical;
	}
	.output {
		margin-top: 0.9rem;
		min-height: 22rem;
	}
	.toggle {
		display: flex;
		align-items: flex-start;
		gap: 0.45rem;
		font-size: 0.875rem;
		cursor: pointer;
	}
	.toggle input {
		margin-top: 0.2rem;
	}
	.columns {
		list-style: none;
		margin: 0.75rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.type {
		padding: 0.6rem 0;
		border-bottom: 1px solid var(--sl-color-gray-6);
	}
	.type:last-of-type {
		border-bottom: none;
	}
	.note {
		margin: 0.6rem 0 0;
		font-size: 0.8rem;
		color: var(--sl-color-gray-2);
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
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.9rem;
	}
	.import {
		margin-top: 0.9rem;
	}
	button {
		padding: 0.45rem 0.8rem;
		border: 1px solid var(--sl-color-gray-5);
		border-radius: 0.4rem;
		background: var(--sl-color-black);
		color: var(--sl-color-white);
		font: inherit;
		font-size: 0.875rem;
		cursor: pointer;
	}
	button:hover {
		background: var(--sl-color-gray-6);
	}
	button.primary {
		background: var(--sl-color-accent);
		border-color: var(--sl-color-accent);
		color: var(--sl-color-black);
		font-weight: 600;
	}
</style>
