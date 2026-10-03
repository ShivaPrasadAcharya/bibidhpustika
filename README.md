# Bibidhpustika

A searchable link catalogue based on Adeshpustika, with exactly three columns: **SN, Subject, URL**.

## Add or edit URLs

Click **Add URL link** on the website. It opens **links.json** directly in GitHub's editor. Sign in to GitHub with repository editing access if needed.

Replace the empty `[]` with entries like this:

```json
[
  {
    "subject": "Your first subject",
    "url": "https://example.com/first"
  },
  {
    "subject": "तपाईंको अर्को विषय",
    "url": "https://example.com/second"
  }
]
```

Use only `subject` and `url`. Add a comma between entries, with no comma after the final entry. Use a complete `https://` or `http://` URL without spaces or embedded login details. Nepali subjects and URLs are supported. The example links above are documentation only; the catalogue starts empty.

Click **Commit changes** and commit to `main`. GitHub Actions validates the entries and publishes the updated site automatically. Wait for **Publish Bibidhpustika** to succeed, then refresh the website. If JSON or an entry is invalid, the workflow reports the problem and the previously published site remains available.

**SN is automatic:** 1, 2, 3, and so on in the order of entries in `links.json`. Sorting, filtering and pagination keep each entry's serial number. Reordering or removing entries renumbers the catalogue on its next update. Do not enter SN manually.

## Browse and search

Search subjects and URLs. **Advanced search** includes all words, any word, exact phrases, field selection, subject/URL contains filters and excluded words. **Nepali normalized search** and **Filter matching rows** are both checked by default inside Advanced search. Uncheck row filtering to retain rows and highlight matches. Exclusions still apply. The count and arrows at the end of the search bar navigate matches across pages; Enter goes forward and Shift+Enter goes backward. Search covers the table, not the contents of linked pages.

The search panel stays visible while scrolling. A floating upward arrow returns to the top. Sort subjects or keep entry order, and choose the number of rows per page. Links open in a new tab. Direct PDF and image URLs open in the template's preview dialog with a full-screen toggle and **Open original** link; preview availability depends on the linked server and browser.

## Browser access screen

The template's two-step browser access screen and session rules are retained, with a separate Bibidhpustika session. The existing mobile number and code are unchanged. Access lasts for a fixed six hours; closing the page for an hour or longer requires verification again. This local screen does not send SMS or provide server authentication. Repository contents, source values and the published links are public.

## Build and hosting

Run `python3 scripts/build-index.py --site` to validate `links.json` and generate `_site`. GitHub Pages uses **GitHub Actions** as its publishing source. Every push to `main` rebuilds and publishes the catalogue. Edit `links.json`, rather than the generated `links-index.js`.
