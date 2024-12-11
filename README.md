# kt-cg-iidx-exporter

Export your IIDX scores from CG into a BATCH-MANUAL JSON for use with [Kamaitachi](https://kamai.tachi.ac/). Works with all three CG instances.

Heavily inspired by [Tina-otoge's CG SDVX scraper](https://gist.github.com/Tina-otoge/bb73a69db2b850c8a4a11bb99845df88).

# Installation

1. Install a userscript manager (e.g. Greasemonkey or Tampermonkey).
2. Create a new script with [kt-cg-iidx-exporter.user.js](https://github.com/tranq88/kt-cg-iidx-exporter/blob/main/kt-cg-iidx-exporter.user.js) as its contents or just click [here](https://github.com/tranq88/kt-cg-iidx-exporter/raw/refs/heads/main/kt-cg-iidx-exporter.user.js).

# Usage

1. Go to https://[...]/iidx/profile
2. Use the button next to the Update button to export; refreshing or leaving the page will cancel the export. Only scores starting from your current page will be exported (see Notes).
3. Go to https://kamai.tachi.ac/import?game=iidx and import via Batch Manual.

# Notes

- At the top of the script there's a constant `PAGE_LIMIT` that sets the maximum number of pages the script will read at a time. For example, suppose you're on page 1 of 20 of your scores:
  - If `PAGE_LIMIT` is set to `10`, then the script will only export your scores from pages 1 to 10.
  - To export the rest, you have to visit page 11 (https://[...]/iidx/profile?page=11) and then click the button again.
  - You can increase this value for convenience but understand that the limit is there to avoid overloading the website.
- Any scores on BEGINNER charts are ignored as Kamaitachi doesn't track them.
