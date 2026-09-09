<script lang="ts">
	import {
		BUILT_IN_LANGUAGES,
		INTERFACE_STRINGS,
		LANGUAGE_PRESETS,
		language,
		nextLanguageName,
		translationSlots,
		type FormState,
		type TranslationSlot,
	} from './form.ts';

	interface Props {
		form: FormState;
	}

	let { form = $bindable() }: Props = $props();

	let slots = $derived(translationSlots(form));

	/** The slot rows, split into the sections the form shows them under. */
	let groups = $derived(
		slots.reduce<Array<{ name: string; rows: TranslationSlot[] }>>((acc, slot) => {
			const last = acc[acc.length - 1];
			if (last?.name === slot.group) last.rows.push(slot);
			else acc.push({ name: slot.group, rows: [slot] });
			return acc;
		}, []),
	);

	let unused = $derived(LANGUAGE_PRESETS.filter(p => !form.languages.some(l => l.tag === p.tag)));

	function addLanguage(tag: string, name: string, suffix: string) {
		form.languages.push(language(tag, name, suffix));
		form.preset = 'custom';
	}

	function removeLanguage(index: number) {
		form.languages.splice(index, 1);
		form.preset = 'custom';
	}

	function move(index: number, delta: number) {
		const target = index + delta;
		if (target < 0 || target >= form.languages.length) return;
		const [item] = form.languages.splice(index, 1);
		form.languages.splice(target, 0, item!);
		form.preset = 'custom';
	}

	/** How much of a language is filled in, so a half-done one is visible at a glance. */
	function filled(index: number): number {
		const text = form.languages[index]!.text;
		return slots.filter(slot => text[slot.id]?.trim()).length;
	}

	function filledStrings(index: number): number {
		const strings = form.languages[index]!.strings;
		return INTERFACE_STRINGS.filter(s => strings[s.key]?.trim()).length;
	}
</script>

<div class="languages">
	<p class="lead">
		English is the base. Every language you add here gets its own column in the sheet, its own
		entry in the language toggle, and its own copy of the wording below. Anything you leave blank
		falls back to English, so a half-translated page is a working page.
	</p>

	{#if !form.languages.length}
		<p class="note">No second language yet. The language button is hidden on a page with one.</p>
	{/if}

	{#each form.languages as lang, index (lang.id)}
		{@const suffix = lang.suffix.trim() || '_XX'}
		{@const next = nextLanguageName(form, lang.tag.trim())}
		<div class="language">
			<div class="options">
				<label class="field narrow">
					<span>Tag</span>
					<input type="text" bind:value={form.languages[index]!.tag} spellcheck="false" />
				</label>
				<label class="field">
					<span>Called</span>
					<input type="text" bind:value={form.languages[index]!.name} />
				</label>
				<label class="field narrow">
					<span>Column suffix</span>
					<input type="text" bind:value={form.languages[index]!.suffix} spellcheck="false" />
				</label>
				<div class="row-tools">
					<button type="button" onclick={() => move(index, -1)} disabled={index === 0} title="Move up">
						↑
					</button>
					<button
						type="button"
						onclick={() => move(index, 1)}
						disabled={index === form.languages.length - 1}
						title="Move down"
					>
						↓
					</button>
					<button type="button" class="remove" onclick={() => removeLanguage(index)}>Remove</button>
				</div>
			</div>

			<p class="note">
				Reviews in {lang.name || lang.tag} go in <code>Comment{suffix}</code>,
				<code>Pros{suffix}</code>, <code>Cons{suffix}</code> and <code>Notes{suffix}</code>.
				{#if next}
					The language button moves from here to {next}.
				{/if}
			</p>

			<details>
				<summary>
					Your wording <span class="count">{filled(index)} of {slots.length}</span>
				</summary>
				<p class="note">
					The English text is on the left. Leave a row blank to show the English on this
					language's pages too.
				</p>
				{#each groups as group (group.name)}
					<h4>{group.name}</h4>
					<div class="rows">
						{#each group.rows as slot (slot.id)}
							<label class="slot" class:long={slot.long}>
								<span class="en">
									{slot.label}
									<em>{slot.en}</em>
								</span>
								{#if slot.long}
									<textarea rows="2" bind:value={form.languages[index]!.text[slot.id]}></textarea>
								{:else}
									<input type="text" bind:value={form.languages[index]!.text[slot.id]} />
								{/if}
							</label>
						{/each}
					</div>
					{#if group.name === 'Sort options'}
						<p class="note">
							<code>{'{rank}'}</code> is replaced with the rank column's name in this language, so
							renaming the column renames its sort options too.
						</p>
					{/if}
				{/each}
			</details>

			<details>
				<summary>
					Interface strings <span class="count">{filledStrings(index)} of {INTERFACE_STRINGS.length}</span>
				</summary>
				{#if BUILT_IN_LANGUAGES.includes(lang.tag.trim())}
					<p class="note">
						{lang.name}'s interface strings ship inside the page. Fill a row in only to override
						the built-in text.
					</p>
				{:else}
					<p class="note">
						The buttons and labels the page writes itself. Every one you skip stays in English.
					</p>
				{/if}
				<div class="rows">
					{#each INTERFACE_STRINGS as string (string.key)}
						<label class="slot">
							<span class="en">
								{string.key}
								<em>{string.en}</em>
								{#if string.hint}<small>{string.hint}</small>{/if}
							</span>
							<input type="text" bind:value={form.languages[index]!.strings[string.key]} />
						</label>
					{/each}
				</div>
			</details>
		</div>
	{/each}

	<div class="add">
		<span>Add a language</span>
		{#each unused as preset (preset.tag)}
			<button type="button" onclick={() => addLanguage(preset.tag, preset.name, preset.suffix)}>
				{preset.name}
			</button>
		{/each}
		<button type="button" onclick={() => addLanguage('', '', '')}>Another…</button>
	</div>
</div>

<style>
	.languages {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.lead {
		margin: 0;
		font-size: 0.85rem;
		color: var(--sl-color-gray-2);
	}
	.note {
		margin: 0.5rem 0 0;
		font-size: 0.78rem;
		color: var(--sl-color-gray-3);
	}
	.language {
		border: 1px solid var(--sl-color-gray-5);
		border-radius: 0.5rem;
		padding: 0.75rem;
	}
	.options {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 0.6rem;
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
		flex: 0 1 7rem;
	}
	.row-tools {
		display: flex;
		gap: 0.3rem;
	}
	button {
		padding: 0.35rem 0.6rem;
		border: 1px solid var(--sl-color-gray-5);
		border-radius: 0.35rem;
		background: var(--sl-color-black);
		color: var(--sl-color-white);
		font: inherit;
		font-size: 0.8rem;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.remove {
		color: var(--sl-color-red);
	}
	details {
		margin-top: 0.6rem;
		border-top: 1px solid var(--sl-color-gray-6, var(--sl-color-gray-5));
		padding-top: 0.5rem;
	}
	summary {
		cursor: pointer;
		font-size: 0.85rem;
	}
	.count {
		color: var(--sl-color-gray-3);
		font-size: 0.75rem;
	}
	h4 {
		margin: 0.9rem 0 0.35rem;
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--sl-color-gray-3);
	}
	.rows {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.slot {
		display: grid;
		grid-template-columns: minmax(8rem, 1fr) minmax(0, 1.4fr);
		align-items: center;
		gap: 0.6rem;
	}
	.slot.long {
		align-items: start;
	}
	.en {
		display: flex;
		flex-direction: column;
		font-size: 0.75rem;
		color: var(--sl-color-gray-2);
		overflow-wrap: anywhere;
	}
	.en em {
		font-style: normal;
		font-size: 0.72rem;
		color: var(--sl-color-gray-3);
	}
	.en small {
		font-size: 0.68rem;
		color: var(--sl-color-gray-4, var(--sl-color-gray-3));
	}
	input,
	textarea {
		width: 100%;
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--sl-color-gray-5);
		border-radius: 0.35rem;
		background: var(--sl-color-black);
		color: var(--sl-color-white);
		font: inherit;
		font-size: 0.85rem;
	}
	textarea {
		line-height: 1.5;
		resize: vertical;
	}
	.add {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		color: var(--sl-color-gray-2);
	}
	@media (max-width: 40rem) {
		.slot {
			grid-template-columns: 1fr;
			gap: 0.2rem;
		}
	}
</style>
