from django.contrib.auth.models import Group, Permission
from django.core.management.base import BaseCommand

ROLES = {
    "Content editor": ["add_passage", "change_passage", "view_passage", "add_document", "change_document",
                       "view_document", "add_event", "change_event", "view_event", "view_seat"],
    "Approver": ["add_passage", "change_passage", "view_passage", "approve_passage", "add_document",
                 "change_document", "view_document", "approve_document", "add_event", "change_event",
                 "view_event", "approve_event", "view_seat", "view_chatlog"],
    "District officer": ["add_event", "change_event", "view_event"],
    "Seat manager": ["add_seat", "change_seat", "view_seat", "delete_seat"],
    "Viewer": ["view_passage", "view_event", "view_seat", "view_chatlog"],
}


class Command(BaseCommand):
    help = "Create the standard officer roles (run after migrate)."

    def handle(self, *args, **opts):
        for name, codes in ROLES.items():
            group, _ = Group.objects.get_or_create(name=name)
            perms = Permission.objects.filter(content_type__app_label="buddy", codename__in=codes)
            if perms.count() != len(codes):
                self.stderr.write(f"Warning: {name}: found {perms.count()} of {len(codes)} permissions")
            group.permissions.set(perms)
            self.stdout.write(f"Role ready: {name}")
