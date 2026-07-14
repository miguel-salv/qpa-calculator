
<div align="center">

# QPA-Calculator

[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

A Quality Point Average (QPA) calculator for Carnegie Mellon University
students. It's a dependency-free static website: plain HTML, CSS, and vanilla
JavaScript, with no Node, no npm, and no build step.

## Table of Contents
- [QPA-Calculator](#qpa-calculator)
  - [Features](#features)
  - [Tech Stack](#tech-stack)
  - [Running the Project](#running-the-project)
  - [PDF Import Setup (one-time)](#pdf-import-setup-one-time)
  - [Project Structure](#project-structure)
  - [Deploying](#deploying)
  - [License](#license)
  - [Contact](#contact)

## Features

- Import courses directly from CMU academic record PDFs
- Add multiple semesters manually
- Add courses with names, grades, and units
- Real-time QPA calculation
- Data stays in your browser — nothing is uploaded to a server
- Responsive layout that works on phones and desktops
- No build tooling and no runtime frameworks

## Tech Stack

- Plain HTML5
- Vanilla JavaScript (ES modules)
- Plain CSS (custom properties)
- [PDF.js](https://mozilla.github.io/pdf.js/) — the only third-party library,
  self-hosted in `vendor/`, used to parse academic-record PDFs

There is **no Node.js or npm requirement**. PDF.js is a static `.js` file loaded
via a `<script>` tag, not an installed package.

## Running the Project

Because it is a static site, simply serve the folder with any static file
server and open it in a browser:

```bash
# Python (already common on most machines)
python -m http.server 8000
# then open http://localhost:8000
```

> Opening `index.html` directly via `file://` mostly works, but browsers block
> ES-module and PDF.js worker loading over `file://`. Use a static server as
> shown above.

## PDF Import Setup (one-time)

The PDF import feature needs two PDF.js files in the `vendor/` folder. Download
the **prebuilt (modern browsers)** PDF.js package once and copy two files from
its `build/` folder into `vendor/`:

- `build/pdf.mjs`        → `vendor/pdf.mjs`
- `build/pdf.worker.mjs` → `vendor/pdf.worker.mjs`

Get the package from either:

- Official download page: https://mozilla.github.io/pdf.js/getting_started/#download (the "Stable" prebuilt link)
- GitHub releases: https://github.com/mozilla/pdf.js/releases (`pdfjs-<version>-dist.zip`)

Manual course entry works without these files; only PDF import requires them.

## Project Structure

```
index.html          Markup, metadata, SEO/JSON-LD, loads CSS + JS
css/styles.css      All styles (theme tokens + components)
js/grades.js        CMU grade model and QPA math
js/transcript.js    CMU academic-record PDF parsing (uses PDF.js)
js/app.js           App state, rendering, dropdown, dialog, toasts
vendor/             Self-hosted PDF.js (pdf.mjs + pdf.worker.mjs)
```

## Deploying

Upload the repository contents to any static host (Cloudflare Pages, GitHub
Pages, Netlify, S3, etc.). No build command is needed; the "build output" is the
repo itself. A `wrangler.toml` is included for Cloudflare Pages.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

Miguel Salvacion - msalvacion@cmu.edu
