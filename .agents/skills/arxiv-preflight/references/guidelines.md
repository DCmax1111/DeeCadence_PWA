# arXiv Submission Guidelines Reference

Comprehensive reference extracted from official arXiv documentation (info.arxiv.org/help/).

## TeX/LaTeX Requirements

### Supported Processors
- LaTeX (DVI mode)
- LaTeX (PDF mode) / PDFLaTeX
- PDFTeX (plain TeX)
- **XeLaTeX** — available since November 2025 (full Unicode, TrueType/OpenType text fonts, OpenType math fonts). Submit with the main file named `xelatex` so arXiv selects the XeLaTeX path.
- **LuaTeX/LuaLaTeX** — under consideration; not officially supported as of this writing. Submissions should not depend on it.
- **NOT supported:** LyX

### TeX Live
- Default: TeX Live 2025
- Only packages included in TeX Live are available — no custom packages beyond what TeX Live provides
- BibLaTeX `.bbl` format: TL2025 requires format 3.3; TL2023 uses 3.2

### File Organization
- Submit as compressed `.tar.gz` or `.zip`
- Main `.tex` in root or subdirectory; compilation occurs from root
- **Include:** `.bbl` (bibliography), `.ind` (index), `.gls`/`.nls` (glossary/nomenclature)
- **Exclude:** `.aux`, `.log`, `.toc`, `.lot`, `.lof`, `.dvi`, `.ps`, `.pdf`, journal templates, referee letters, backup files
- Hidden files (starting with `.`) are deleted upon announcement
- Subdirectories have no write permission — use `\input{subdir/file}` not `\include{subdir/file}`

### Figure Formats by Processor
| Processor | Accepted Formats |
|-----------|-----------------|
| LaTeX (DVI) | `.ps`, `.eps` only |
| PDFLaTeX | `.pdf`, `.png`, `.jpg` |

- Use `graphics` or `graphicx` packages with `\includegraphics`
- `psfig` package NOT supported
- No on-the-fly format conversion — authors must pre-convert
- No embedded JavaScript, animated GIFs, or movies in PDFs (submit as ancillary files)

### Bibliography
- Upload `.bib` files or pre-generated `.bbl` files
- `.bbl` filename must match corresponding `.tex` file
- BibLaTeX: document and `.bbl` must be created by the same program (Biber or BibTeX)
- Include arXiv identifiers in references (YYMM.NNNNN format)
- No extraneous font commands, spaces, tildes, braces, or line-breaks within e-print identifiers

### Restrictions
- No custom style files beyond TeX Live
- Avoid double-spaced "referee" mode formatting
- Do not use `\today` macro (causes date variation)
- Embedded JavaScript = automatic rejection
- `\pdfoutput` testing: use `ifpdf` package, not `\ifx\pdfoutput\undefined`
- Shell-escape disabled (affects `minted.sty` — use `frozencache=true`)
- `xr` package does not work (file paths differ on arXiv servers)

## PDF Requirements

### General
- Single PDF containing all text and figures
- PDFs created from TeX/LaTeX typically rejected (submit source instead)
- Mixed file types prohibited

### Fonts
- ALL fonts (standard and non-standard) must be embedded
- Use outline fonts (TrueType/Type 1), NOT bitmap (Type 3) fonts
- Type 3 fonts prevent machine readability
- Custom fonts must be embedded to prevent substitution
- Pre-unicode font encoding for ligatures (ff, fi, fl) causes accessibility issues

### Machine Readability
- Full-text search capability required
- Screen reader compatibility required
- No bitmapped/scanned papers
- No Type 3 fonts
- Use standard fonts and formatting (heading styles, structured lists, proper tables)
- Include alt text with images

### Content Restrictions
- No embedded JavaScript, animated GIFs, movies, HTML
- Copyright statements permitted if they don't impair arXiv redistribution license
- IEEE: "Accepted" versions OK, "Published" versions NOT accepted

## Metadata Requirements

### Title
- No all-uppercase letters
- No Unicode characters (use TeX equivalents)
- Limited MathJax support
- Expand cryptic TeX macros (e.g., "Nonlinear Sigma Models" not `\nlsm`)

### Authors
- Format: `Firstname Lastname` or `Firstname Middlename Lastname`
- No honorifics (Dr., Professor)
- Include ALL authors (no `et al.` truncation)
- Separate with commas or "and"
- No all-uppercase names
- Affiliations in parentheses — no full mailing addresses
- Roles (editor, appendix author) NOT in Authors field — use Comments field

### Abstract
- Do NOT include the word "Abstract"
- Maximum 1920 characters
- Formatted to wrap at 80 characters for email announcements
- Indent lines after carriage returns for paragraphs/tables
- Do not start lines with whitespace unless preventing auto line-wrapping
- Expand opaque TeX macros; omit formatting commands (`\em`, `\it`)
- Limited MathJax support

### Comments (Optional but Recommended)
- Indicate page count and figure count
- Publication status ("to be published in", "submitted to")
- Author roles ("Appendix by")
- Copyright statements go on front page, NOT in comments
- Add space after URLs to separate from following text

### ASCII Only
- All metadata fields accept ASCII input only
- Unicode → TeX equivalents (curved quotes, long hyphens, ligatures)

## File Size

### Image Warning Threshold
- PNG images > 34 Megapixel (≈ A4 at 600 DPI) trigger submission warning (since Feb 2026)
- PNG optimization: avoid palette indexing, alpha channels, color profiles, metadata, interlacing

### General
- No published absolute submission size cap
- Efficient format usage required
- JPEG for photographs, PDF/PNG for diagrams/line drawings
- No omitted figures allowed
- Exception process available for very long papers (reviews, theses) with genuinely efficient figures

## Figure Preparation

### Format Recommendations
- Use `pdflatex` — directly supports `.jpg`, `.png`, `.pdf` figures
- EPS/PostScript: often verbose, convert to bitmap or PDF for size reduction
- Data files underlying plots → submit as ancillary files

### Recommended Tools
- **ImageMagick** — format conversion, optimization
- **Ghostscript** — PostScript distilling (`ps2ps`, `eps2eps`)
- **GIMP** — editing, format conversion
- **jpeg2ps** — JPEG to compressed PostScript (use `-h` hex-encoded option)

## Ancillary Files

- Supplementary materials: raw data, code, images, movies, spreadsheets
- Only supported with TeX/PDFLaTeX source submissions (NOT PDF submissions)
- Place in `anc/` directory at root of archive
- No TeX files in ancillary directory
- No internal references to ancillary directory (links may break)
- No PDFs with embedded JavaScript
- Full text in ancillary directory NOT indexed in searches
- Files stored per version — updates require full resubmission

## 00README.XXX Directives

| Directive | Syntax | Purpose |
|-----------|--------|---------|
| Ignore file | `filename.ext ignore` | Exclude from processing |
| Include file | `filename.ext include` | Prevent unknown-type detection |
| Top-level TeX | `myfile.tex toplevelfile` | Declare main TeX file |
| Landscape | `filename.dvi landscape` | DVI landscape mode |
| No HyperTeX | `nohypertex` | Disable auto hyperlinks |
| Keep PS comments | `filename.dvi keepcomments` | Preserve PS comments (`-K0`) |
| No stamp | `nostamp` | Remove arXiv stamp |

Multiple `toplevelfile` declarations supported — creates combined PDF in specified order.

## Common Errors

### File Issues
- **Absolute paths** — use relative paths only
- **Spaces/special chars in filenames** — converted to underscores; update inclusion commands
- **Missing custom style files** — include all non-TeX-Live files

### LaTeX Errors
- `Missing number, treated as zero` — move `%%BoundingBox` to top of PS file
- `Can't write subdir/file.aux` — use `\input` not `\include` for subdirectory files
- `Double subscript/superscript` — explicit bracing required (`a_{x}_y`)
- `Command \Bbbk already defined` — `\let\Bbbk\relax` between conflicting packages
- `Option clash for package` — use `ifpdf` package for pdfoutput testing

### Processing Issues
- No user interaction during processing — create `.inp` files for responses
- No concatenated source files — use archives
- Use current official style file versions
- `\protect\cite{ref}` inside captions

### Package-Specific
- `minted.sty` — `\usepackage[frozencache=true,cachedir=minted-cache]{minted}`
- `hyperref` with complex sections — `\usepackage[bookmarks=false]{hyperref}`
- `breqn` + `hyperref` — manage underscore catcodes after `\usepackage{breqn}`

## LaTeX Best Practices (Accessibility)

- Standardized front matter: `\title{}`, `\author{}` with `\AND`, `\begin{abstract}...\end{abstract}`
- Image alt text: `\includegraphics[alt={description}]{filename}`
- Semantic markup: `\emph{text}` over `{\it text}`, `\section{Title}` over manual formatting
- Use LaTeXML-compatible packages for HTML conversion

## Submission Statuses

| Status | Meaning |
|--------|---------|
| Incomplete | In process, not submitted. Expires after 14 days of inactivity |
| Processing | Received, undergoing analysis. No edits allowed |
| Submitted | Ready for announcement. Can "Unsubmit" to return to incomplete |
| On Hold | Flagged by moderation. Does not expire. Do NOT delete and resubmit |

## SWORD API

- Endpoint: `https://arxiv.org/sword-app/`
- Two-step: media deposit (POST file) → metadata wrapper (POST atom XML)
- Primarily for conference organizers / bulk upload
- HTTP Basic Auth over HTTPS
- License pre-registration required at `https://arxiv.org/sword-license`
