# Question Bingo

## Connect Google Sheets

1. Put one question per row in a Google Sheet. The first row should contain a `question` header.
2. Publish the sheet as CSV: **File → Share → Publish to web → CSV**.
3. Copy [config.example.js](./config.example.js) to `config.js` and put the published URL in `QUESTION_CSV_URL`.

To save submissions, open **Extensions → Apps Script** from the destination spreadsheet, paste in [Code.gs](./Code.gs), and create a `Questions` sheet. The web app accepts a JSON `POST` with this shape:

```json
{
  "username": "sunny-side-up",
  "answers": [{ "question": "…", "answer": "…" }]
}
```

The script stores submissions in an `Answers` sheet and returns `{ "ok": true, "username": "…", "answers": [...] }` for a new user. For an existing username, it returns the saved card with `"duplicate": true`. Put the deployment URL in `SUBMIT_URL` in `config.js`. The endpoint must allow requests from the site origin.

### Apps Script queue setup

The web endpoint queues submissions in Apps Script Properties instead of reading or writing Sheets on every request. A time-driven trigger writes the queue as one batch every five minutes, but only when at least two submissions are waiting. Duplicate usernames are rejected immediately, including while a submission is still queued.

After pasting the code:

1. If the `Answers` sheet already contains submissions, run `initializeUsernameIndex` once from the Apps Script editor.
2. Run `installQueueTrigger` once and authorize the script. This replaces any existing `processQueue` trigger with one that runs every five minutes.
3. Deploy or update the web app (**Execute as: Me**, **Who has access: Anyone**).

## GitHub Pages

The repository includes a GitHub Actions workflow that publishes the site whenever `main` changes. Add these repository secrets before deploying:

- `POG_QUESTION_CSV_URL`
- `POG_SUBMIT_URL`

The workflow generates the untracked `config.js` during deployment. These URLs are configuration values delivered to the browser, not cryptographic secrets; this setup keeps them out of the repository and its history. If the existing Apps Script deployment URL was intended to be private, redeploy it because any browser-based client can discover its URL.

For a quick preview, open [index.html](./index.html) directly. With no URLs configured, the app uses a built-in demo question pool and shows the submission result without making a network request.
