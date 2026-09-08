/**
 * Schema version understood by this build.
 *
 * 2 added `scale` on the rank column, which lets `filter.values`,
 * `stats.chartColors` and the Score column all be omitted.
 *
 * 3 added `chrome`. The page shell is now three empty landmarks and core
 * builds everything inside them, so the header title, the header links, which
 * toggles appear and the whole footer moved out of `index.html` and into the
 * config. A version-2 config renders a page with no title and no footer.
 */
export declare const CONFIG_VERSION = 3;
/** A raw CSV row: header name -> trimmed cell value. */
export type Row = Record<string, string>;
/** Language tag used for chrome strings and per-locale data fields. */
export type Lang = string;
/**
 * A string that may vary per language.
 * `'Rank'` and `{ default: 'Rank', i18n: { ko: '등급' } }` are both valid.
 */
export type I18nString = string | {
    default?: string;
    i18n?: Record<Lang, string>;
};
/** Where a type's rows come from. Only published-CSV sources are supported today. */
export interface SourceConfig {
    kind: 'csv';
    /** Published Google Sheet CSV URL, or any URL serving CSV. */
    url: string;
}
/** One device category. Each key becomes a toggle button and a valid `?type=` value. */
export interface TypeConfig {
    label: I18nString;
    source: SourceConfig;
    /** Path to a CrinGraph-style `phone_book.json`, used to resolve measurement links. */
    phonebook?: string;
    /** Measurement URL template; `{file}` is replaced with the encoded phonebook filename. */
    measurementUrl?: string;
    /** Target of the header "measurements" icon while this type is active. */
    measurementsPageUrl?: string;
    /** Fallback values applied to blank cells on rows of this type. */
    defaults?: Record<string, string>;
    /**
     * Optional row filter for single-sheet deploys: keep only rows whose
     * `field` equals one of `values` (case-insensitive).
     */
    rowFilter?: {
        field: string;
        values: string[];
    };
}
/** Semantic hints that let core sort and match without hardcoding column names. */
export type ColumnRole = 'rank' | 'brand' | 'model' | 'score';
/**
 * One step of a rank scale, best first.
 *
 * A scale is the single source of truth for a rank column: it supplies the
 * filter dropdown options, the sort order, the badge color, the chart colors,
 * and the numeric value used for averages when the sheet has no Score cell.
 * Declaring `scale` replaces four hand-aligned lists with one.
 */
export interface RankScaleEntry {
    /** Cell value as written in the sheet, e.g. `'S'`, `'4.5'`, `'8'`. */
    value: string;
    /** Numeric worth of this step. Used for score sort and the average readout. */
    score?: number;
    /** Badge background. Also feeds the stats chart when `chartColors` is unset. */
    color?: string;
    /** Badge text color. Defaults to white. */
    textColor?: string;
    /** Badge and dropdown text. Defaults to `value`. */
    label?: I18nString;
    /** Extra CSS class on the badge, for operators styling from their own sheet. */
    class?: string;
}
/** Visual slot a rendered column occupies on a card. */
export type Slot = 'rank' | 'title' | 'meta' | 'actions' | 'body';
/** Visual treatment for a `block` renderer. */
export type BlockStyle = 'plain' | 'up' | 'down' | 'note' | 'muted';
export type RenderConfig = 
/**
 * Colored badge. Color comes from the column's `scale`; `classMap` is the
 * pre-scale way of picking a class per value and still wins when both are set.
 */
{
    kind: 'rank-badge';
    classMap?: Record<string, string>;
}
/**
 * A row of star icons. The cell value is read as a number out of `max`,
 * halves included, so `4.5` draws four full stars and one half star.
 */
 | {
    kind: 'stars';
    max?: number;
}
/**
 * A numeric score in a pill whose color is interpolated across `colors`
 * between `min` and `max`, so a 0-to-10 or 0-to-100 scale needs no per-value list.
 */
 | {
    kind: 'score-badge';
    min?: number;
    max?: number;
    colors?: string[];
    decimals?: number;
}
/** Card heading; `template` interpolates `{Field}` placeholders from the row. */
 | {
    kind: 'title';
    template?: string;
}
/** Chip in the meta row. Consecutive chips are separated automatically. */
 | {
    kind: 'meta-chip';
}
/** Plain span. */
 | {
    kind: 'text';
}
/** Plain span, sorted numerically. */
 | {
    kind: 'numeric';
}
/** Anchor; `hrefTemplate` interpolates `{Field}`, `href` is used verbatim. */
 | {
    kind: 'link';
    hrefTemplate?: string;
    href?: string;
    text?: I18nString;
    newTab?: boolean;
}
/**
 * A paragraph block in the card body. Line breaks in the cell are preserved.
 * `style` selects icon and color treatment; `up`/`down`/`note` are labelled blocks.
 */
 | {
    kind: 'block';
    style?: BlockStyle;
}
/** Splits the cell on `separator` and renders each piece as a pill. */
 | {
    kind: 'tags';
    separator?: string;
}
/** Anchor whose href is resolved against the active type's phonebook. */
 | {
    kind: 'measurement-link';
}
/** Not rendered; the column still participates in filtering, sorting and search. */
 | {
    kind: 'none';
};
export type FilterConfig = 
/** Substring match against `match` fields, or the column's own source field. */
{
    kind: 'text';
    match?: string[];
}
/** Exact-match dropdown built from `values`, or from the column's `scale`. */
 | {
    kind: 'select';
    values?: string[];
}
/** Exact-match dropdown whose options are collected from the loaded rows. */
 | {
    kind: 'select-auto';
};
export interface ColumnConfig {
    /** Unique id; referenced by sort keys and filter state. */
    id: string;
    /** CSV header this column reads. Optional for template-only columns. */
    source?: string;
    /** Per-language CSV header override, e.g. `{ en: 'Pros', ko: 'Pros_KR' }`. */
    i18nSource?: Record<Lang, string>;
    /** Semantic hint used by sorting and phonebook matching. */
    role?: ColumnRole;
    /**
     * Ordered rank steps, best first. Only meaningful on the `rank` role column.
     * Supplies filter options, sort order, badge colors, chart colors and scores.
     */
    scale?: RankScaleEntry[];
    label: I18nString;
    /** Short heading shown above a `block` renderer. Defaults to `label` for labelled styles. */
    blockLabel?: I18nString;
    sortable?: boolean;
    filter?: FilterConfig;
    render?: RenderConfig;
    /** Restrict this column to the listed types. */
    showForTypes?: string[];
    /** Override the renderer's default slot. */
    placement?: Slot;
}
export interface SearchConfig {
    enabled?: boolean;
    /** CSV headers searched by the free-text box. Defaults to every column source. */
    fields?: string[];
    label?: I18nString;
}
export interface SortConfig {
    /** Sort key applied on load, e.g. `'rank-asc'`. */
    default?: string;
    /** Offered sort keys, each `{columnId}-{asc|desc}`. */
    options?: string[];
    /** Optional label overrides; unlisted keys get a generated label. */
    labels?: Record<string, I18nString>;
}
export interface StatsConfig {
    enabled?: boolean;
    /** Average readout; `source` is a CSV header, `denominator` is display-only. */
    average?: {
        source: string;
        denominator?: string;
    };
    /**
     * Bar colors, index-aligned with the rank values. Optional when the rank
     * column declares a `scale`, whose colors are used instead.
     */
    chartColors?: string[];
    /** Chart.js URL, loaded on first open of the stats modal. */
    chartLibUrl?: string;
}
/** Built-in icons a chrome link can draw. */
export type ChromeIcon = 'measurements' | 'external' | 'info';
/** A link in the header bar or the footer. */
export interface ChromeLink {
    href: string;
    /** Visible text. A link with only an `icon` renders as an icon button. */
    label?: I18nString;
    /** Icon drawn before the label. */
    icon?: ChromeIcon;
    /** Tooltip and accessible name. Defaults to `label`. */
    title?: I18nString;
    /** Open in a new tab. */
    newTab?: boolean;
}
export interface FooterConfig {
    /**
     * The disclaimer under the list. Pass an array for several paragraphs.
     * There is no built-in default: an unset note renders nothing.
     */
    note?: I18nString | I18nString[];
    /** Links along the footer's bottom row. */
    links?: ChromeLink[];
}
/**
 * The page shell: header, footer, and which of the built-in controls appear.
 *
 * `index.html` ships three empty landmarks — `#ranking-header`,
 * `#ranking-content` and `#ranking-footer` — and core builds what goes inside
 * them from here. Nothing on this page needs the markup edited to be branded.
 */
export interface ChromeConfig {
    /** Header title. `false` renders no title at all. */
    title?: I18nString | false;
    /** Second line under the title. */
    subtitle?: I18nString;
    /** Wraps the title in a link, e.g. back to the measurement site. */
    titleUrl?: string;
    /** Show the light/dark toggle. Defaults to true. */
    themeToggle?: boolean;
    /** Show the language toggle. Defaults to true when more than one language is offered. */
    languageToggle?: boolean;
    /** Show the measurements icon for types declaring `measurementsPageUrl`. Defaults to true. */
    measurementsLink?: boolean;
    /** Extra header links, rendered before the built-in buttons. */
    links?: ChromeLink[];
    footer?: FooterConfig;
}
export interface DeepLinkConfig {
    /** Anchor template, e.g. `'{Brand}-{Model}'`. */
    template?: string;
    slugify?: 'lowercase-hyphen' | 'none';
}
/**
 * Where the page loads its own build from. Read by loader.js before core exists,
 * so nothing here reaches core — it is declared for the editor's benefit.
 *
 * The defaults suit both deploys, and most operators never set any of it.
 */
export interface CdnConfig {
    /**
     * `'auto'` (default) follows loader.js: a copy in your own folder means the
     * build is there too, the CDN copy means fetch the published build. Override
     * with `'local'` or `'cdn'` when you mix the two.
     */
    source?: 'auto' | 'local' | 'cdn';
    /** Exact version to load, e.g. `'1.2.3'`. Skips the version lookup entirely. */
    version?: string;
    /** Major version to track. Defaults to the highest published. */
    majorVersion?: number;
    /** CDN base URL. Defaults to the project's jsDelivr URL. */
    base?: string;
    /** Full URL to versions.json. Defaults to the raw GitHub equivalent of `base`. */
    versionsUrl?: string;
    /** Load the readable `core.js` rather than `core.min.js`. */
    debug?: boolean;
}
export interface RankingConfig {
    /** Schema version this config targets. Core warns when it does not match. */
    configVersion?: number;
    types: Record<string, TypeConfig>;
    columns: ColumnConfig[];
    /** Header, footer and the built-in controls. */
    chrome?: ChromeConfig;
    search?: SearchConfig;
    sort?: SortConfig;
    stats?: StatsConfig;
    deepLink?: DeepLinkConfig;
    /** Languages offered by the toggle, in cycle order. Defaults to `['en', 'ko']`. */
    languages?: Lang[];
    /** Overrides for built-in chrome strings, keyed by language then string id. */
    i18n?: Record<Lang, Record<string, string>>;
    /** Where the page loads its own build from. Read by loader.js, not by core. */
    cdn?: CdnConfig;
}
declare global {
    interface Window {
        RANKING_CONFIG?: RankingConfig;
    }
}
