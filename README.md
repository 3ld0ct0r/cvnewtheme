# cvnewtheme

`cvnewtheme` is a reusable Hugo resume theme built for responsive reading and A4 export. The theme owns presentation, validation, typography, icons, accessibility, and print behavior. A consuming site owns resume content plus the destinations, labels, order, and placement of its links.

The distributed theme contains compiled Bootstrap 5 CSS, a self-hosted variable font, and eight inline Font Awesome SVG definitions. A consumer needs Hugo 0.164.0 or newer. It does not need Bun, Python, Sass, a font CDN, or a browser icon runtime.

## Use the theme

1. Add the theme as a submodule from the Hugo site root. Replace `<theme-repository-url>` with the repository URL; an adjacent checkout can use `../cvnewtheme`.

   ```bash
   git submodule add --branch dev <theme-repository-url> themes/cvnewtheme
   ```

2. Configure the theme and locale.

   ```toml
   theme = "cvnewtheme"
   locale = "en"
   ```

3. Copy the content structure from `exampleSite/config.toml`, replace every `YOUR_...` value and `.invalid` URL, and define the semantic resume-link registry described below.

4. Preview and build.

   ```bash
   hugo server
   hugo --gc --minify --panicOnWarning
   ```

## Resume-link registry

The registry is required. `header` controls the visible contact list and `actions` controls the icon-only strip above Skills. Array order is both visual order and keyboard order. An empty array intentionally disables that surface.

```toml
[params.resumeLinks]
header = ["online_cv", "website", "location"]
actions = ["online_cv", "email", "linkedin", "github"]

[params.resumeLinks.items.online_cv]
kind = "online-cv"
url = "https://YOUR_CV.example.invalid/"
text = "Online CV"
label = "View online CV"

[params.resumeLinks.items.website]
kind = "website"
url = "https://YOUR_SITE.example.invalid/"
text = "YOUR_WEBSITE"
label = "Visit website"

[params.resumeLinks.items.location]
kind = "location"
text = "YOUR_CITY, YOUR_COUNTRY"
label = "Location: YOUR_CITY, YOUR_COUNTRY"

[params.resumeLinks.items.email]
kind = "email"
url = "mailto:YOUR_EMAIL@example.invalid"
text = "YOUR_EMAIL@example.invalid"
label = "Email YOUR_NAME"

[params.resumeLinks.items.linkedin]
kind = "linkedin"
url = "https://YOUR_LINKEDIN_PROFILE.example.invalid/"
text = "LinkedIn"
label = "View LinkedIn profile"

[params.resumeLinks.items.github]
kind = "github"
url = "https://YOUR_GITHUB_PROFILE.example.invalid/"
text = "GitHub"
label = "View GitHub profile"
```

Supported kinds are `online-cv`, `website`, `linkedin`, `github`, `email`, `phone`, `pdf`, and `location`. The theme selects the icon. Consumers do not configure Font Awesome classes.

The build fails with a `resumeLinks:` error when the registry is malformed. Important rules are:

- IDs use lowercase snake case and every selected ID must exist.
- An ID may appear once in each surface, but not twice in one surface.
- Every declared item is validated, including currently unselected items.
- Every item requires `kind`, `text`, and `label`; all except `location` require `url`.
- Web identity links require absolute HTTPS URLs without credentials.
- Email requires `mailto:` and phone requires `tel:`.
- `location` has no URL and is permitted only in the header.
- Values are rendered as escaped plain text.
- Header links expose `<text> — <label>` as their accessible name so the visible text remains part of the name; action links use `label`, and a location exposes its configured `label` alongside the visible text.
- Links stay in the current tab. Website, LinkedIn, and GitHub receive `rel="me"`; PDF receives `download`.

The old `params.contact`, `params.social`, URL heuristics, and raw Font Awesome class configuration are not supported.

### Enable a PDF action

PDF activation is atomic. First add a real file at `static/resume.pdf`, then add the item and select it:

```toml
[params.resumeLinks]
header = ["online_cv", "website", "location"]
actions = ["online_cv", "email", "pdf", "linkedin", "github"]

[params.resumeLinks.items.pdf]
kind = "pdf"
url = "/resume.pdf"
text = "Resume PDF"
label = "Download resume PDF"
```

PDF paths must be normalized root-relative lowercase `.pdf` paths. They cannot contain a query, fragment, percent escape, backslash, protocol-relative prefix, or dot segment. The build verifies a regular file under the consumer's default `static/` directory. Custom `staticDir` values and module-mounted static assets are outside the v1 file-existence contract.

## Typography and icons

The theme uses `CV Resume Sans`, an OFL-compliant modified subset of Mona Sans v2.0.27. Four WOFF2 files cover normal and italic Latin and Latin-ext text across weights 400 through 800 and widths 95% through 100%. Only normal Latin is preloaded.

The supplied broad Unicode literals overlap at seven codepoints despite being described as non-overlapping. The generator records both supplied ranges, assigns every shared codepoint to Latin, and verifies that the effective Latin-ext range is exactly the supplied range minus Latin. This preserves the combined repertoire while making browser range selection deterministic.

Font Awesome Free 7.3.1 supplies eight allowlisted SVG geometries. The build converts them into a controlled JSON registry and the Hugo templates render them inline. No Font Awesome JavaScript, CSS, webfont, `<i>` class, or external icon request is used.

Source versions, transformations, licenses, SHA-256 hashes, and byte sizes are recorded in `assets/generated/dependencies.json` and `THIRD_PARTY_NOTICES.md`.

## Develop the theme

The reproducible theme toolchain is pinned to:

- Bun 1.3.14
- Bootstrap 5.3.8
- Font Awesome Free 7.3.1
- Dart Sass 1.101.0
- Hugo Extended 0.164.0
- Python 3.14.6
- uv 0.11.29
- FontTools 4.63.0
- Playwright 1.61.1
- Axe Playwright 4.12.1
- PDF.js 6.1.200

Install the locked JavaScript and Python graphs:

```bash
bun install --frozen-lockfile
uv sync --locked
bunx playwright install
```

Available commands:

| Command | Purpose |
|---|---|
| `bun run build:assets` | Compile Sass and regenerate committed fonts, icons, licenses, and provenance. |
| `bun run check:assets` | Rebuild in temporary storage and fail on missing, stale, or unexpected generated files. |
| `bun run vendor:mona` | Intentionally refresh the three allowlisted Mona Sans inputs from the hash-pinned release archive. |
| `bun run build:example` | Strictly build the maximum-content example with warnings treated as errors. |
| `bun run test:browser` | Run responsive, accessibility, font, interaction, and network checks. |
| `bun run test:pdf` | Generate and inspect the Chromium A4 PDFs. |
| `bun run test:e2e` | Run browser and PDF suites. |
| `bun run test:consumer -- <site-source>` | Run the reusable consumer acceptance harness. |
| `bun run capture:consumer-screenshots -- <site-source>` | Capture the tracked 390x844 and 1440x1200 consumer viewport previews. Add `--configured-theme` after pinning a release. |
| `bun run test:unit` | Run the deterministic Bun fixture and migration tests without invoking Playwright specs. |
| `bun run check` | Run asset freshness, Bun tests, strict Hugo build, browser tests, and PDF tests. |
| `bun run dev` | Regenerate assets and serve the example from memory. |
| `bun run deps:outdated` | Perform the advisory recursive package-registry scan. |

For complete local verification:

```bash
bun run check
```

The direct strict example build is:

```bash
hugo --source exampleSite --themesDir ../.. --theme cvnewtheme \
  --gc --ignoreCache --minify --panicOnWarning --noBuildLock
```

`bun run deps:outdated` is an advisory release check, not deterministic CI. Registry state can change while the lockfiles remain reproducible.

Ordinary asset builds and CI never download upstream font files. `bun run vendor:mona` is a deliberate maintainer-only source refresh: it verifies the pinned v2.0.27 release-archive SHA-256, extracts only the two approved variable TTFs and `OFL.txt`, and verifies each source hash before replacing the vendored inputs. It also accepts a previously downloaded archive through `--archive` when an offline review is required.

For a release candidate, refresh generated artifacts, record the advisory dependency state, and run every deterministic gate:

```bash
bun install --frozen-lockfile
uv sync --locked
bunx playwright install chromium firefox webkit
bun run build:assets
bun run deps:outdated
bun run check
```

After pinning a consumer to the verified theme commit, refresh its exact-size
viewport previews through the configured theme:

```bash
bun run capture:consumer-screenshots -- ../cvitals --configured-theme
```

## Generated assets

Generated outputs are committed so downstream Hugo sites do not need the theme-development toolchain. Do not edit these files by hand.

- `assets/generated/devresume.min.css`
- `assets/generated/icons.json`
- `assets/generated/dependencies.json`
- `static/generated/fonts/*.woff2`
- `static/generated/licenses/*`

After changing Sass, the allowlisted icons, font inputs, dependency versions, or the build pipeline, run `bun run build:assets` and commit source, locks, and generated outputs together.

Font budgets are enforced at 90 KiB for initial normal Latin, 96 KiB for any one WOFF2, and 240 KiB across all four files. The icon registry is limited to 20,480 uncompressed bytes.

## Print contract

The theme keeps a 60/40 A4 composition and a minimum of 8.75pt for main print copy and 8pt for secondary copy. The PDF self-download action is omitted from printed output; other configured links remain clickable.

Exactly one A4 page is an acceptance requirement for `cvitals` and the maximum-content example fixture. It is not a promise for unlimited consumer content. Longer resumes must paginate without clipped or lost text instead of silently shrinking below the type floor.

## Attribution and licenses

The original DevResume attribution remains in `LICENSE.md` and `theme.toml`. Mona Sans and Font Awesome attribution and redistribution terms are preserved in `THIRD_PARTY_NOTICES.md`, the published license files, generated metadata, and the rendered Font Awesome attribution comment.
