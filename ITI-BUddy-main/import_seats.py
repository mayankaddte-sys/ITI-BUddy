import csv

from django.core.management.base import BaseCommand, CommandError

from buddy.models import Seat


class Command(BaseCommand):
    help = ("Import seats from CSV with columns: iti_code,iti_name,district,trade,iti_type,seats,"
            "duration_months,qualification,women_only")

    def add_arguments(self, parser):
        parser.add_argument("csv_path")
        parser.add_argument("--session", default="2026-27")
        parser.add_argument("--replace", action="store_true", help="Delete existing seats of this session first")

    def handle(self, *args, **o):
        rows, bad = [], 0
        try:
            f = open(o["csv_path"], newline="", encoding="utf-8-sig")
        except OSError as e:
            raise CommandError(str(e))
        with f:
            for r in csv.DictReader(f):
                try:
                    if r["iti_type"] not in ("G", "S", "P", "V"):
                        raise ValueError("iti_type")
                    rows.append(Seat(
                        session=o["session"], iti_code=r["iti_code"].strip(), iti_name=r["iti_name"].strip(),
                        district=r["district"].strip(), trade=r["trade"].strip(), iti_type=r["iti_type"],
                        seats=int(r["seats"]), duration_months=int(r["duration_months"] or 24),
                        qualification=int(r["qualification"] or 10), women_only=r["women_only"] in ("1", "true", "True")))
                except (KeyError, ValueError):
                    bad += 1
        if not rows:
            raise CommandError("No valid rows found.")
        if o["replace"]:
            Seat.objects.filter(session=o["session"]).delete()
        Seat.objects.bulk_create(rows, batch_size=2000)
        self.stdout.write(f"Imported {len(rows)} rows, skipped {bad}.")
