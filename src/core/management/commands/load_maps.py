import json
from pathlib import Path

from django.core.management.base import BaseCommand
from core.models import Map

MAPS_DIR = Path(__file__).resolve().parent.parent.parent.parent.parent / "sandbox" / "maps"


class Command(BaseCommand):
    help = "Load map JSON files into the database"

    def handle(self, *args, **options):
        for f in MAPS_DIR.glob("*.json"):
            slug = f.stem
            grid = json.loads(f.read_text())
            obj, created = Map.objects.update_or_create(
                slug=slug,
                defaults={"name": slug.replace("_", " ").title(), "grid_json": grid},
            )
            status = "created" if created else "updated"
            self.stdout.write(f"  {status}: {obj.name}")
