# ITI Buddy

Guided chatbot for UP ITI trainees: admission and fees, seat availability, exams, scholarship,
placement and apprenticeship melas, session dates and contact.

| Folder | What it is | Where it runs |
|---|---|---|
| `site/` | The public chat page (`index.html`, one file, works without a server) | Netlify (publish directory `site`, set in `netlify.toml`) |
| `backend/` | Django admin login, roles, approval workflow and API | Your own server (not Netlify). See `backend/README.md` |

Seat data comes from the UP ITI admission booklet 2026-27. Entries marked [Sample] / [नमूना] in the page are
placeholders until official notices are loaded. Never commit `.env`, `db.sqlite3` or real passwords.
