# CSV / Excel Table Importer — Trello Power-Up

Imports a CSV or Excel file, shows it as a table on the back of a card, and can
optionally convert every row into its own card on a list you choose.

## What it does

- **Import CSV/Excel** button on any card → upload a `.csv`, `.xlsx`, or `.xls`
  file → preview it → save it as a table attached to that card.
- **Data Table** section automatically appears on the back of the card,
  showing the saved table (read-only view).
- **Row count badge** on the front of the card (e.g. "42 rows").
- **Convert rows to cards**: pick a list and which column is the card title,
  and each row becomes a new card (other columns go into the card description).

## Files

```
index.html      Power-Up connector (loads client.js)
client.js       Registers capabilities (badges, buttons, card-back section)
manifest.json   Power-Up metadata Trello reads
import.html/js  The import popup: parsing, preview, save, convert-to-cards
table-view.html/js  Read-only table shown on the card back
settings.html/js    Where you paste a personal Trello token (needed only for
                    the "convert to cards" feature)
```

## 1. Host the files

Trello requires your Power-Up to be served over **HTTPS** from a public URL.
Any static host works — easiest options:

- **GitHub Pages**: push this folder to a repo, enable Pages, done.
- **Netlify / Vercel**: drag-and-drop deploy.
- **Glitch**: paste files in, it gives you an https URL instantly.

## 2. Get a Trello API key

1. Go to https://trello.com/power-ups/admin
2. Click **New**, give it a name, pick a workspace.
3. In the Power-Up's settings, go to **API Key**, generate one, and copy it.
4. Set the **Iframe connector URL** to `https://YOUR_DOMAIN/index.html`.

## 3. Fill in your key

Open `import.js` and `settings.js` and replace:

```js
var APP_KEY = 'YOUR_TRELLO_APP_KEY';
```

with the key from step 2. Also update the two `YOUR_DOMAIN_HERE` placeholders
in `manifest.json`.

Re-deploy the updated files.

## 4. Enable it on your board

On any Trello board → Power-Ups → Custom → find your Power-Up → Enable.

## 5. Connect a token (only needed for "convert rows to cards")

Reading/writing a card's own table doesn't need a token. Creating brand-new
cards via the REST API does. On the board, click the **Trello API Token**
board button this Power-Up adds, follow the "generate a token" link, and paste
it back in. It's stored privately per-member (`t.set('member','private',...)`),
never shared with other board members.

## Notes / limits

- Trello's Power-Up shared storage caps each key at ~4096 characters, so the
  table is automatically split into chunks (`tableChunk_0`, `tableChunk_1`,
  …) under a `tableMeta` key. This is handled for you — no size limit on the
  file itself in practice, just more chunks for bigger files.
- The preview shows the first 200 rows for performance; the full dataset is
  still saved/converted.
- Card creation is done one row at a time with a small delay to stay under
  Trello's API rate limits. For very large files (hundreds+ of rows) this can
  take a bit — the popup shows live progress and you can see partial results
  if it's interrupted (it also reports which row it stopped at).
- All parsing (CSV via PapaParse, Excel via SheetJS) happens client-side in
  the browser — no data is sent anywhere except to Trello itself.
