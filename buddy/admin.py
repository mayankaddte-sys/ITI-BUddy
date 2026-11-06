from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User
from django.utils import timezone

from .models import ChatLog, Document, Event, Passage, Seat, UserProfile

DISTRICT_ROLE = "District officer"


class ApprovalMixin:
    """Editors save as Pending. Only users with the approve permission can publish."""
    approve_perm = ""

    def save_model(self, request, obj, form, change):
        if obj.status == "approved":
            if not request.user.has_perm("buddy." + self.approve_perm):
                obj.status = "pending"
                messages.warning(request, "Only an Approver can publish. Saved as Pending approval.")
            elif not obj.approved_by_id:
                obj.approved_by, obj.approved_at = request.user, timezone.now()
        if hasattr(obj, "updated_by"):
            obj.updated_by = request.user
        if hasattr(obj, "uploaded_by") and not change:
            obj.uploaded_by = request.user
        super().save_model(request, obj, form, change)

    @admin.action(description="Approve selected (publish)")
    def approve(self, request, queryset):
        if not request.user.has_perm("buddy." + self.approve_perm):
            self.message_user(request, "You do not have permission to approve.", level=messages.ERROR)
            return
        n = queryset.update(status="approved", approved_by=request.user, approved_at=timezone.now())
        self.message_user(request, f"{n} item(s) approved and live.")

    @admin.action(description="Archive selected")
    def archive(self, request, queryset):
        self.message_user(request, f"{queryset.update(status='archived')} item(s) archived.")

    actions = ["approve", "archive"]


@admin.register(Passage)
class PassageAdmin(ApprovalMixin, admin.ModelAdmin):
    approve_perm = "approve_passage"
    list_display = ("title_en", "category", "status", "valid_to", "needs_hindi_review", "updated_at")
    list_filter = ("status", "category", "needs_hindi_review")
    search_fields = ("title_en", "title_hi", "text_en", "text_hi")
    readonly_fields = ("approved_by", "approved_at", "updated_by", "updated_at")


@admin.register(Document)
class DocumentAdmin(ApprovalMixin, admin.ModelAdmin):
    approve_perm = "approve_document"
    list_display = ("title", "doc_type", "language", "status", "valid_to", "uploaded_by")
    list_filter = ("status", "doc_type")
    search_fields = ("title",)
    readonly_fields = ("approved_by", "approved_at", "updated_by", "updated_at", "uploaded_by")


@admin.register(Event)
class EventAdmin(ApprovalMixin, admin.ModelAdmin):
    approve_perm = "approve_event"
    list_display = ("date", "title", "kind", "district", "venue", "status")
    list_filter = ("status", "kind", "district")
    search_fields = ("title", "venue", "district")
    date_hierarchy = "date"
    readonly_fields = ("approved_by", "approved_at", "updated_by", "updated_at")

    def _own_district(self, request):
        """Return the district for a District officer, '' for everyone else, None if not set up."""
        if request.user.is_superuser or not request.user.groups.filter(name=DISTRICT_ROLE).exists():
            return ""
        profile = getattr(request.user, "profile", None)
        return profile.district if profile and profile.district else None

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        d = self._own_district(request)
        if d == "":
            return qs
        return qs.none() if d is None else qs.filter(district__iexact=d)

    def save_model(self, request, obj, form, change):
        d = self._own_district(request)
        if d:
            obj.district = d
        super().save_model(request, obj, form, change)


@admin.register(Seat)
class SeatAdmin(admin.ModelAdmin):
    list_display = ("iti_name", "district", "trade", "iti_type", "seats", "session")
    list_filter = ("session", "iti_type", "district")
    search_fields = ("iti_name", "iti_code", "trade", "district")


@admin.register(ChatLog)
class ChatLogAdmin(admin.ModelAdmin):
    list_display = ("created", "question", "lang", "answered", "matched", "feedback")
    list_filter = ("answered", "lang", "feedback")
    search_fields = ("question",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


class ProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False


class UserAdminWithProfile(UserAdmin):
    inlines = [ProfileInline]


admin.site.unregister(User)
admin.site.register(User, UserAdminWithProfile)
