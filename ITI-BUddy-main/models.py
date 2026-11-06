from django.conf import settings
from django.db import models
from django.utils import timezone

STATUS = [("draft", "Draft"), ("pending", "Pending approval"), ("approved", "Approved (live)"), ("archived", "Archived")]
CATEGORY = [("Admission", "Admission"), ("Seats", "Seats"), ("Exam", "Exam"), ("Session", "Session"),
            ("Scholarship", "Scholarship"), ("Placement", "Placement and apprenticeship"),
            ("Support", "Contact and support"), ("Other", "Other")]
ITI_TYPE = [("G", "Government"), ("S", "Government (SCVT)"), ("P", "Government PPP"), ("V", "Private")]


class UserProfile(models.Model):
    """Extra data for officers. A District officer can only edit events of this district."""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    district = models.CharField(max_length=80, blank=True, help_text="Used for District officer accounts")
    designation = models.CharField(max_length=120, blank=True)
    mobile = models.CharField(max_length=15, blank=True)

    def __str__(self):
        return f"{self.user.get_username()} ({self.district or 'all'})"


class LiveQuerySet(models.QuerySet):
    def live(self):
        today = timezone.localdate()
        return (self.filter(status="approved")
                .filter(models.Q(valid_from__isnull=True) | models.Q(valid_from__lte=today))
                .filter(models.Q(valid_to__isnull=True) | models.Q(valid_to__gte=today)))


class Approvable(models.Model):
    status = models.CharField(max_length=10, choices=STATUS, default="draft", db_index=True)
    valid_from = models.DateField(null=True, blank=True)
    valid_to = models.DateField(null=True, blank=True, help_text="Content stops showing after this date")
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, editable=False,
                                    on_delete=models.SET_NULL, related_name="+")
    approved_at = models.DateTimeField(null=True, blank=True, editable=False)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, editable=False,
                                   on_delete=models.SET_NULL, related_name="+")
    updated_at = models.DateTimeField(auto_now=True)
    objects = LiveQuerySet.as_manager()

    class Meta:
        abstract = True


class Document(Approvable):
    title = models.CharField(max_length=200)
    doc_type = models.CharField(max_length=30, choices=[("notice", "Notice"), ("circular", "Circular"),
                                                         ("prospectus", "Prospectus"), ("other", "Other")], default="notice")
    language = models.CharField(max_length=2, choices=[("en", "English"), ("hi", "Hindi"), ("bi", "Both")], default="bi")
    file = models.FileField(upload_to="docs/%Y/%m")
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, editable=False,
                                    on_delete=models.SET_NULL, related_name="+")

    class Meta:
        permissions = [("approve_document", "Can approve documents")]

    def __str__(self):
        return self.title


class Passage(Approvable):
    category = models.CharField(max_length=20, choices=CATEGORY, default="Other", db_index=True)
    title_en = models.CharField(max_length=200)
    title_hi = models.CharField(max_length=200, blank=True)
    text_en = models.TextField()
    text_hi = models.TextField(blank=True)
    source = models.CharField(max_length=250, blank=True, help_text="Notice name, date or website shown to trainees")
    document = models.ForeignKey(Document, null=True, blank=True, on_delete=models.SET_NULL)
    needs_hindi_review = models.BooleanField(default=True)

    class Meta:
        permissions = [("approve_passage", "Can approve passages")]
        ordering = ["category", "title_en"]

    def __str__(self):
        return f"{self.category}: {self.title_en}"


class Event(Approvable):
    kind = models.CharField(max_length=20, choices=[("placement", "Placement mela"), ("apprenticeship", "Apprenticeship mela"),
                                                     ("counselling", "Counselling"), ("other", "Other")], default="placement")
    title = models.CharField(max_length=200)
    title_hi = models.CharField(max_length=200, blank=True)
    date = models.DateField(db_index=True)
    end_date = models.DateField(null=True, blank=True)
    time_text = models.CharField(max_length=60, blank=True, help_text="e.g. 10 am onwards")
    venue = models.CharField(max_length=250)
    district = models.CharField(max_length=80, db_index=True)
    details = models.TextField(blank=True)
    details_hi = models.TextField(blank=True)
    link = models.URLField(blank=True)

    class Meta:
        permissions = [("approve_event", "Can approve events")]
        ordering = ["date"]

    def __str__(self):
        return f"{self.date} {self.title} ({self.district})"


class Seat(models.Model):
    session = models.CharField(max_length=10, default="2026-27", db_index=True)
    iti_code = models.CharField(max_length=10, db_index=True)
    iti_name = models.CharField(max_length=250)
    district = models.CharField(max_length=80, blank=True, db_index=True)
    trade = models.CharField(max_length=160, db_index=True)
    iti_type = models.CharField(max_length=1, choices=ITI_TYPE, db_index=True)
    seats = models.PositiveIntegerField()
    duration_months = models.PositiveSmallIntegerField(default=24)
    qualification = models.PositiveSmallIntegerField(default=10, help_text="8 or 10 (Class pass)")
    women_only = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.iti_name} - {self.trade} ({self.seats})"


class ChatLog(models.Model):
    """Anonymous log: no names, no phone numbers."""
    question = models.CharField(max_length=500)
    lang = models.CharField(max_length=2, default="en")
    answered = models.BooleanField(default=False)
    matched = models.CharField(max_length=200, blank=True)
    feedback = models.SmallIntegerField(null=True, blank=True, help_text="1 = helpful, -1 = not helpful")
    created = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created"]
