# ITI Buddy backend (starter)

Django project with a secure **admin login**, officer roles, an approval workflow and a small JSON API
for the ITI Buddy chat page.

> Status: written but **not run** in the environment where it was produced (Django could not be installed
> there). Python files compile; run the steps below on your server and fix anything that surfaces.

## 1. Set up (about 10 minutes)

```bash
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # then edit it; load it into your shell/service
export $(grep -v '^#' .env | xargs)     # or use your process manager's env file
export DJANGO_DEBUG=1           # only on your own computer, for testing

python manage.py makemigrations buddy
python manage.py migrate
python manage.py setup_roles
python manage.py createsuperuser
python manage.py import_seats data/seats.csv --replace      # 10,756 rows from the 2026-27 booklet
python manage.py loaddata buddy/fixtures/initial_content.json   # starter passages and mela dates
python manage.py runserver
```

Admin login: `http://localhost:8000/staff-portal/` (the path comes from `ADMIN_URL`; change it in production).

## 2. Roles

| Role | Can do |
|---|---|
| Super admin (`createsuperuser`) | Everything, creates officer accounts |
| Content editor | Write passages, events and documents. Saves go to **Pending approval** |
| Approver | Everything an editor can, plus **publish** passages, events and documents |
| District officer | Add and edit **events of their own district only** (set the district in the user's profile) |
| Seat manager | Add, edit, delete seats |
| Viewer | Read-only, including the chat log |

Create an officer: Admin > Users > Add user, then open the user, tick the role under Groups and fill
the Profile section (district for District officers).

Nothing reaches trainees until an Approver sets it to **Approved** and the dates are valid. Every change is
recorded by Django's History button on each item.

## 3. Login protection built in

- Account and IP locked for 1 hour after 5 wrong passwords (django-axes).
- Passwords need 10+ characters and cannot be common or numeric-only.
- Sessions end after 8 hours. Cookies are HTTPS-only and HSTS is on when `DJANGO_DEBUG` is not 1.
- Admin sits on a private URL, not `/admin/`.

Add before going live: **two-step login** (OTP app) with `django-otp` or `django-two-factor-auth`, a
security audit by an empanelled auditor, IP allow-listing of the admin path at your web server, and
regular backups.

## 4. API (for the chat page)

| Endpoint | Purpose |
|---|---|
| `GET /api/passages` | All live (approved, in-date) passages in English and Hindi |
| `GET /api/districts` | Districts that have seats |
| `GET /api/trades?district=&type=G,S,P,V` | Trades with seat totals |
| `GET /api/seats?district=&trade=&type=` | Institutes with approved seats (not live vacancy) |
| `GET /api/events?district=` | Upcoming approved melas and events |
| `POST /api/chat` `{q, lang}` | Keyword answer from live passages, logs the question |
| `POST /api/feedback` `{id, value}` | 1 helpful, -1 not helpful |

Set `CORS_ALLOW_ORIGIN` to the address of the page that calls these.

## 5. Deploy (outline)

`gunicorn config.wsgi` behind nginx with HTTPS, PostgreSQL (set the `DB_*` variables and uncomment
`psycopg` in requirements), `python manage.py collectstatic`, and a nightly backup of the database and
`media/`.

## 6. Next steps

1. Change the chat page to read `/api/passages`, `/api/seats` and `/api/events` instead of its built-in copy,
   so staff updates reach trainees without editing the file.
2. Seat import screen inside the admin (the command works today).
3. Daily alert to Approvers about passages that expire within 7 days.
4. Meaning-based search (pgvector) and WhatsApp connection.

## 7. Content you must still verify

Passages loaded from the fixture arrive as **Pending** or **Draft**. Dates, the Hindi text, scholarship
details and mela dates came from news reports, so a department officer should check each one before
approving it.
