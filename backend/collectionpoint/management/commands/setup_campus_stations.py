import json
import uuid
import os
from django.core.management.base import BaseCommand, CommandError
from collectionpoint.models import CollectionPoint

class Command(BaseCommand):
    help = 'Setup or import official campus collection stations from a JSON configuration file.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--file',
            type=str,
            help='Path to a JSON file containing official campus station definitions.'
        )
        parser.add_argument(
            '--export-template',
            type=str,
            help='Export a blank JSON template file for configuring official campus stations.'
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing stations before loading new ones (Caution: do not use in active production).'
        )

    def handle(self, *args, **options):
        if options['export_template']:
            template_path = options['export_template']
            template_data = {
                "stations": [
                    {
                        "code": "OFFICIAL-STATION-CODE-1",
                        "building": "OFFICIAL-BUILDING-NAME",
                        "floor": "OFFICIAL-FLOOR-NUMBER",
                        "name": "OFFICIAL-CABIN-OR-STATION-NAME",
                        "status": "ACTIVE",
                        "directions": "OFFICIAL-WALKING-DIRECTIONS",
                        "opening_hours": {
                            "Monday - Friday": "09:00 - 17:00"
                        }
                    },
                    {
                        "code": "OFFICIAL-STATION-CODE-2",
                        "building": "OFFICIAL-BUILDING-NAME",
                        "floor": "OFFICIAL-FLOOR-NUMBER",
                        "name": "OFFICIAL-CABIN-OR-STATION-NAME",
                        "status": "ACTIVE",
                        "directions": "OFFICIAL-WALKING-DIRECTIONS",
                        "opening_hours": {
                            "Monday - Friday": "09:00 - 17:00"
                        }
                    }
                ]
            }
            with open(template_path, 'w', encoding='utf-8') as f:
                json.dump(template_data, f, indent=2)
            self.stdout.write(self.style.SUCCESS(f"Official station template exported to '{template_path}'."))
            return

        if not options['file']:
            count = CollectionPoint.objects.count()
            self.stdout.write(self.style.WARNING(
                f"No --file specified. Current station count in database: {count}.\n"
                f"Usage:\n"
                f"  python manage.py setup_campus_stations --export-template stations_template.json\n"
                f"  python manage.py setup_campus_stations --file your_campus_stations.json"
            ))
            return

        file_path = options['file']
        if not os.path.exists(file_path):
            raise CommandError(f"Station file '{file_path}' does not exist.")

        with open(file_path, 'r', encoding='utf-8') as f:
            try:
                stations_data = json.load(f)
            except json.JSONDecodeError as e:
                raise CommandError(f"Invalid JSON in '{file_path}': {e}")

        # Support both direct list and {"stations": [...]} or {"collection_points": [...]}
        if isinstance(stations_data, dict):
            stations_data = stations_data.get('stations') or stations_data.get('collection_points') or []

        if not isinstance(stations_data, list):
            raise CommandError("Station file must contain a JSON array or an object with a 'stations' array.")

        if options['clear']:
            deleted, _ = CollectionPoint.objects.all().delete()
            self.stdout.write(self.style.WARNING(f"Cleared {deleted} existing station(s)."))

        created_count = 0
        updated_count = 0

        for st in stations_data:
            station_code = (st.get('station_code') or st.get('code') or '').strip().upper()
            building = (st.get('building') or '').strip()
            station_type = (st.get('station_type') or st.get('name') or 'Campus Collection Desk').strip()
            if not station_code or not building:
                self.stdout.write(self.style.ERROR(f"Skipping entry missing required station code or building: {st}"))
                continue

            obj, created = CollectionPoint.objects.update_or_create(
                station_code=station_code,
                defaults={
                    'public_id': st.get('public_id') or str(uuid.uuid4()),
                    'building': building,
                    'floor': str(st.get('floor', '')).strip(),
                    'station_type': station_type,
                    'status': st.get('status', 'ACTIVE'),
                    'zone': st.get('zone', ''),
                    'directions': st.get('directions', ''),
                    'opening_hours': st.get('opening_hours', {}),
                }
            )
            if created:
                created_count += 1
            else:
                updated_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"Official campus stations setup complete: {created_count} created, {updated_count} updated."
        ))
