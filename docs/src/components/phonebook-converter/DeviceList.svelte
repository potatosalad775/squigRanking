<script lang="ts">
	// The editable list. A phone book of six hundred devices is normal, so brands
	// start collapsed and a search opens only what matches: the alternative is two
	// thousand inputs mounted to show one of them.
	import type { DeviceRow } from './sheet.ts';

	interface Props {
		rows: DeviceRow[];
		/** The chosen scale's values, offered as a datalist on the Rank cells. */
		scaleValues: string[];
		/** Fired on the first edit, so the parent can say what a rebuild would cost. */
		onedit: () => void;
	}

	let { rows = $bindable(), scaleValues, onedit }: Props = $props();

	let search = $state('');
	let opened = $state<Record<string, boolean>>({});

	interface Group {
		id: string;
		rows: DeviceRow[];
		shown: DeviceRow[];
	}

	// Grouped by the brand's position in the source file, not by its name, so
	// renaming a brand does not scatter its devices across the list.
	const groups = $derived.by(() => {
		const byBrand = new Map<string, Group>();
		for (const row of rows) {
			const id = row.key.split('.')[0] ?? row.brand;
			const group = byBrand.get(id) ?? { id, rows: [], shown: [] };
			group.rows.push(row);
			byBrand.set(id, group);
		}
		return [...byBrand.values()];
	});

	const needle = $derived(search.trim().toLowerCase());

	const visible = $derived.by(() => {
		if (!needle) return groups.map(group => ({ ...group, shown: group.rows }));
		return groups
			.map(group => ({
				...group,
				shown: group.rows.filter(row =>
					`${row.brand} ${row.model} ${row.file}`.toLowerCase().includes(needle),
				),
			}))
			.filter(group => group.shown.length > 0);
	});

	const included = $derived(rows.filter(row => row.include).length);
	const shownRows = $derived(visible.flatMap(group => group.shown));

	function edit(): void {
		onedit();
	}

	function renameBrand(group: Group, name: string): void {
		for (const row of group.rows) row.brand = name;
		edit();
	}

	function setGroup(group: Group, include: boolean): void {
		for (const row of group.shown) row.include = include;
		edit();
	}

	function setShown(include: boolean): void {
		for (const row of shownRows) row.include = include;
		edit();
	}

	function isOpen(id: string): boolean {
		// A search has already narrowed the list to what the operator asked for;
		// making them click each brand open again would just repeat the question.
		return needle !== '' || opened[id] === true;
	}

	function setAllOpen(open: boolean): void {
		opened = Object.fromEntries(groups.map(group => [group.id, open]));
	}
</script>

<datalist id="pbc-scale">
	{#each scaleValues as value (value)}
		<option {value}></option>
	{/each}
</datalist>

<div class="toolbar">
	<label class="search">
		<span class="visually-hidden">Search the list</span>
		<input
			type="search"
			bind:value={search}
			placeholder="Search brand, model or measurement file"
			spellcheck="false"
		/>
	</label>
	<span class="count">{included} of {rows.length} going in the sheet</span>
	<button type="button" onclick={() => setShown(true)}>Include shown</button>
	<button type="button" onclick={() => setShown(false)}>Exclude shown</button>
	<button type="button" onclick={() => setAllOpen(true)}>Expand all</button>
	<button type="button" onclick={() => setAllOpen(false)}>Collapse all</button>
</div>

{#if !visible.length}
	<p class="empty">Nothing matches “{search}”.</p>
{/if}

<ul class="brands">
	{#each visible as group (group.id)}
		{@const all = group.shown.every(row => row.include)}
		<li class="brand">
			<div class="brand-head">
				<input
					type="checkbox"
					checked={all}
					indeterminate={!all && group.shown.some(row => row.include)}
					onchange={event => setGroup(group, event.currentTarget.checked)}
					aria-label={`Include every ${group.rows[0]?.brand} device`}
				/>
				<input
					class="brand-name"
					type="text"
					value={group.rows[0]?.brand ?? ''}
					oninput={event => renameBrand(group, event.currentTarget.value)}
					aria-label="Brand"
				/>
				<button
					type="button"
					class="disclose"
					aria-expanded={isOpen(group.id)}
					onclick={() => (opened = { ...opened, [group.id]: !isOpen(group.id) })}
				>
					{group.shown.length}
					{group.shown.length === 1 ? 'device' : 'devices'}
					<span class="chevron" class:open={isOpen(group.id)} aria-hidden="true">›</span>
				</button>
			</div>

			{#if isOpen(group.id)}
				<ul class="devices">
					{#each group.shown as row (row.key)}
						<li class="device" class:excluded={!row.include}>
							<input
								type="checkbox"
								bind:checked={row.include}
								onchange={edit}
								aria-label={`Include ${row.brand} ${row.model}`}
							/>
							<div class="fields">
								<input
									class="model"
									type="text"
									bind:value={row.model}
									oninput={edit}
									aria-label="Model"
								/>
								<input
									class="rank"
									type="text"
									list="pbc-scale"
									bind:value={row.rank}
									oninput={edit}
									placeholder="Rank"
									aria-label="Rank"
								/>
							</div>
							<p class="hint">
								{row.file}{row.variations > 1 ? ` · ${row.variations} measurements` : ''}
							</p>
						</li>
					{/each}
				</ul>
			{/if}
		</li>
	{/each}
</ul>

<style>
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}
	.search {
		flex: 1 1 16rem;
	}
	.count {
		font-size: 0.8rem;
		color: var(--sl-color-gray-2);
	}
	.brands,
	.devices {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.brand {
		border-top: 1px solid var(--sl-color-gray-6);
	}
	.brand:last-child {
		border-bottom: 1px solid var(--sl-color-gray-6);
	}
	.brand-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.35rem 0;
	}
	.brand-name {
		flex: 1 1 auto;
		min-width: 0;
		font-weight: 600;
	}
	.disclose {
		flex: 0 0 auto;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.78rem;
		color: var(--sl-color-gray-2);
		white-space: nowrap;
	}
	.chevron {
		display: inline-block;
		transition: transform 0.12s ease;
	}
	.chevron.open {
		transform: rotate(90deg);
	}
	.devices {
		padding: 0 0 0.5rem 1.6rem;
	}
	.device {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: center;
		gap: 0.15rem 0.5rem;
		padding: 0.2rem 0;
	}
	.device.excluded .fields,
	.device.excluded .hint {
		opacity: 0.45;
	}
	.fields {
		display: flex;
		gap: 0.4rem;
		min-width: 0;
	}
	.model {
		flex: 1 1 auto;
		min-width: 0;
	}
	.rank {
		flex: 0 0 6rem;
	}
	.hint {
		grid-column: 2;
		margin: 0;
		font-size: 0.72rem;
		color: var(--sl-color-gray-3);
		overflow-wrap: anywhere;
	}
	.empty {
		font-size: 0.85rem;
		color: var(--sl-color-gray-2);
	}
	input[type='text'],
	input[type='search'] {
		width: 100%;
		padding: 0.3rem 0.45rem;
		border: 1px solid var(--sl-color-gray-5);
		border-radius: 0.35rem;
		background: var(--sl-color-black);
		color: var(--sl-color-white);
		font: inherit;
		font-size: 0.85rem;
	}
	button {
		padding: 0.3rem 0.6rem;
		border: 1px solid var(--sl-color-gray-5);
		border-radius: 0.4rem;
		background: var(--sl-color-black);
		color: var(--sl-color-white);
		font: inherit;
		font-size: 0.8rem;
		cursor: pointer;
	}
	button:hover {
		background: var(--sl-color-gray-6);
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
