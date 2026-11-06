import json
import re

from django.conf import settings
from django.db.models import Sum
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .models import ChatLog, Event, Passage, Seat

STOP = set("a an the is are to of for in on and or what how do i my me can when where which about with from the "
           "कब क्या है हैं का की के में से को कैसे और".split())


def api(*methods):
    """Allow only the listed methods, answer CORS pre-flight and add the CORS header."""
    def deco(fn):
        @csrf_exempt
        def wrapper(request, *a, **kw):
            if request.method == "OPTIONS":
                resp = HttpResponse(status=204)
            elif request.method not in methods:
                resp = JsonResponse({"error": "method not allowed"}, status=405)
            else:
                resp = fn(request, *a, **kw)
            if settings.CORS_ALLOW_ORIGIN:
                resp["Access-Control-Allow-Origin"] = settings.CORS_ALLOW_ORIGIN
                resp["Access-Control-Allow-Headers"] = "Content-Type"
                resp["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
            return resp
        return wrapper
    return deco


def _types(request):
    t = [c for c in request.GET.get("type", "").upper().split(",") if c in "GSPV"]
    return t or ["G", "S", "P", "V"]


@api("GET")
def passages(request):
    rows = Passage.objects.live().values("category", "title_en", "title_hi", "text_en", "text_hi", "source")
    return JsonResponse({"passages": list(rows)})


@api("GET")
def districts(request):
    d = Seat.objects.exclude(district="").values_list("district", flat=True).distinct().order_by("district")
    return JsonResponse({"districts": list(d)})


@api("GET")
def trades(request):
    qs = Seat.objects.filter(iti_type__in=_types(request))
    if request.GET.get("district"):
        qs = qs.filter(district__iexact=request.GET["district"])
    rows = qs.values("trade").annotate(total=Sum("seats")).order_by("-total")
    return JsonResponse({"trades": list(rows)})


@api("GET")
def seats(request):
    qs = Seat.objects.filter(iti_type__in=_types(request))
    if request.GET.get("district"):
        qs = qs.filter(district__iexact=request.GET["district"])
    if request.GET.get("trade"):
        qs = qs.filter(trade__iexact=request.GET["trade"])
    rows = (qs.values("iti_code", "iti_name", "trade", "iti_type", "duration_months", "qualification", "women_only")
              .annotate(total=Sum("seats")).order_by("-total")[:200])
    return JsonResponse({"note": "Approved seats, not live vacancy.", "seats": list(rows)})


@api("GET")
def events(request):
    from django.utils import timezone
    qs = Event.objects.live().filter(date__gte=timezone.localdate())
    if request.GET.get("district"):
        qs = qs.filter(district__iexact=request.GET["district"])
    rows = qs.values("kind", "title", "title_hi", "date", "end_date", "time_text", "venue", "district",
                     "details", "details_hi", "link")[:100]
    return JsonResponse({"events": list(rows)})


@api("POST")
def chat(request):
    try:
        body = json.loads(request.body or b"{}")
    except ValueError:
        return JsonResponse({"error": "bad json"}, status=400)
    q = str(body.get("q", ""))[:500].strip()
    lang = "hi" if body.get("lang") == "hi" else "en"
    if not q:
        return JsonResponse({"error": "empty question"}, status=400)
    toks = [t for t in re.split(r"[\s,.;:!?()\[\]\"'।/]+", q.lower()) if t and t not in STOP]
    best, score = None, 0
    for p in Passage.objects.live():
        title = f"{p.title_en} {p.title_hi}".lower()
        text = f"{p.text_en} {p.text_hi}".lower()
        s = sum(text.count(t) + 3 * title.count(t) for t in toks)
        if s > score:
            best, score = p, s
    answered = best is not None and score >= 2
    log = ChatLog.objects.create(question=q, lang=lang, answered=answered, matched=best.title_en if answered else "")
    if not answered:
        msg = ("यह जानकारी मेरे पास नहीं मिली। कृपया अपने आईटीआई के प्रधानाचार्य से संपर्क करें।" if lang == "hi"
               else "I could not find that. Please contact your ITI principal.")
        return JsonResponse({"id": log.id, "answered": False, "answer": msg})
    text = best.text_hi if lang == "hi" and best.text_hi else best.text_en
    return JsonResponse({"id": log.id, "answered": True, "answer": text, "source": best.source,
                         "title": best.title_hi if lang == "hi" and best.title_hi else best.title_en})


@api("POST")
def feedback(request):
    try:
        body = json.loads(request.body or b"{}")
        value = 1 if int(body.get("value", 0)) > 0 else -1
        ChatLog.objects.filter(pk=int(body.get("id"))).update(feedback=value)
    except (ValueError, TypeError):
        return JsonResponse({"error": "bad request"}, status=400)
    return JsonResponse({"ok": True})
