<div align="center">

# QPA-Calculator

**A Quality Point Average calculator for Carnegie Mellon University students.**

[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

Import your courses from a CMU academic-record PDF or enter them by hand, and get
your QPA instantly. Everything runs in your browser, and nothing is ever uploaded.

## Features

- Import courses directly from CMU academic record PDFs
- Add multiple semesters and courses manually
- Real-time QPA calculation
- Data stays in your browser, nothing is uploaded to a server
- Responsive layout for phones and desktops

## Built With

Plain HTML5, vanilla JavaScript (ES modules), and CSS custom properties. The only
third-party library is [PDF.js](https://mozilla.github.io/pdf.js/), self-hosted in
`vendor/` to parse academic-record PDFs.

## Project Structure

```
index.html          Markup, metadata, SEO/JSON-LD, loads CSS + JS
css/styles.css      All styles (theme tokens + components)
js/grades.js        CMU grade model and QPA math
js/transcript.js    CMU academic-record PDF parsing (uses PDF.js)
js/app.js           App state, rendering, dropdown, dialog, toasts
vendor/             Self-hosted PDF.js (pdf.mjs + pdf.worker.mjs)
```

## License

Licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contact

Miguel Salvacion - msalvacion@cmu.edu
