import json
import uuid
import os
from django.core.management.base import BaseCommand, CommandError
from collectionpoint.models import CollectionPoint, CampusConfig, CampusBlock

class Command(BaseCommand):
    help = 'Setup or import official campus collection stations, institution info, and blocks from a JSON configuration file.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--file',
            type=str,
            help='Path to a JSON file containing official campus station, block, and institution definitions.'
        )
        parser.add_argument(
            '--export-template',
            type=str,
            help='Export a blank JSON template file for configuring official campus stations and institution.'
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
                "campus": {
                    "name": "Medicaps University",
                    "address": "A.B. Road, Pigdamber, Rau, Indore, Madhya Pradesh – 453331, India",
                    "locality": "Pigdamber, Rau",
                    "city": "Indore",
                    "state": "Madhya Pradesh",
                    "country": "India",
                    "pin_code": "453331",
                    "contact_email": "",
                    "contact_phone": "",
                    "website": "",
                    "maps_link": ""
                },
                "blocks": [
                    {
                        "code": "BLOCK-A",
                        "name": "Block A",
                        "description": "Admin Block"
                    }
                ],
                "stations": [
                    {
                        "code": "MED-BLK-B000",
                        "name": "B Block Station B 000",
                        "building": "Block B — EC/IT/Commerce",
                        "block_code": "BLOCK-B",
                        "requires_block_confirmation": False,
                        "status": "UNVERIFIED",
                        "floor": "",
                        "capacity": 50,
                        "directions": "",
                        "map_link": "",
                        "opening_hours": {}
                    }
                ]
            }
            with open(template_path, 'w', encoding='utf-8') as f:
                json.dump(template_data, f, indent=2)
            self.stdout.write(self.style.SUCCESS(f"Official station template exported to '{template_path}'."))
            return

        if not options['file']:
            count = CollectionPoint.objects.count()
            block_count = CampusBlock.objects.count()
            self.stdout.write(self.style.WARNING(
                f"No --file specified. Current in database: {count} stations, {block_count} blocks.\n"
                f"Usage:\n"
                f"  python manage.py setup_campus_stations --export-template stations_template.json\n"
                f"  python manage.py setup_campus_stations --file campus_stations.json"
            ))
            return

        file_path = options['file']
        if not os.path.exists(file_path):
            raise CommandError(f"Station file '{file_path}' does not exist.")

        with open(file_path, 'r', encoding='utf-8') as f:
            try:
                raw_data = json.load(f)
            except json.JSONDecodeError as e:
                raise CommandError(f"Invalid JSON in '{file_path}': {e}")

        # 1. Process campus metadata
        if isinstance(raw_data, dict):
            campus_meta = raw_data.get('campus') or raw_data.get('institution')
            if campus_meta and isinstance(campus_meta, dict):
                cfg = CampusConfig.get_solo()
                for k in ['name', 'address', 'locality', 'city', 'state', 'country', 'pin_code', 'contact_email', 'contact_phone', 'website', 'maps_link']:
                    if k in campus_meta and campus_meta[k]:
                        setattr(cfg, k, str(campus_meta[k]).strip())
                if cfg.name and cfg.name != 'Campus Configuration Pending':
                    cfg.is_configured = True
                cfg.save()
                self.stdout.write(self.style.SUCCESS(f"Official campus information configured: {cfg.name}"))

        # 2. Process blocks
        blocks_data = []
        if isinstance(raw_data, dict):
            blocks_data = raw_data.get('blocks') or []

        block_created = 0
        block_updated = 0
        block_map = {}

        for b in blocks_data:
            code = (b.get('code') or '').strip().upper()
            name = (b.get('name') or '').strip()
            # Normalize typo "Bock N" to "Block N"
            if name == 'Bock N':
                name = 'Block N'
            desc = (b.get('description') or '').strip()
            if not code or not name:
                continue

            blk_obj, created = CampusBlock.objects.update_or_create(
                code=code,
                defaults={
                    'name': name,
                    'description': desc
                }
            )
            block_map[code] = blk_obj
            block_map[name.upper()] = blk_obj
            if created:
                block_created += 1
            else:
                block_updated += 1

        if blocks_data:
            self.stdout.write(self.style.SUCCESS(
                f"Campus blocks configured: {block_created} created, {block_updated} updated (Total: {CampusBlock.objects.count()})."
            ))

        # 3. Process stations
        stations_data = raw_data
        if isinstance(stations_data, dict):
            stations_data = stations_data.get('stations') or stations_data.get('collection_points') or []

        if not isinstance(stations_data, list):
            raise CommandError("Station file must contain a JSON array or an object with a 'stations' array.")

        if options['clear']:
            deleted, _ = CollectionPoint.objects.all().delete()
            self.stdout.write(self.style.WARNING(f"Cleared {deleted} existing station(s)."))

        created_count = 0
        updated_count = 0
        ambiguous_stations = []

        for st in stations_data:
            station_code = (st.get('station_code') or st.get('code') or '').strip().upper()
            building = (st.get('building') or '').strip()
            station_type = (st.get('station_type') or st.get('name') or 'Campus Collection Desk').strip()
            if not station_code or not building:
                self.stdout.write(self.style.ERROR(f"Skipping entry missing required station code or building: {st}"))
                continue

            # Resolve block association
            block_ref = st.get('block_code') or st.get('block') or ''
            assigned_block = None
            if block_ref:
                block_key = str(block_ref).strip().upper()
                assigned_block = block_map.get(block_key) or CampusBlock.objects.filter(code=block_key).first()

            requires_confirm = bool(st.get('requires_block_confirmation', False))
            if requires_confirm or not assigned_block:
                if requires_confirm:
                    ambiguous_stations.append(f"{station_code} ({station_type}): Flagged for administrative block confirmation.")

            lat = st.get('latitude')
            lng = st.get('longitude')

            obj, created = CollectionPoint.objects.update_or_create(
                station_code=station_code,
                defaults={
                    'public_id': st.get('public_id') or str(uuid.uuid4()),
                    'building': building,
                    'block': assigned_block,
                    'requires_block_confirmation': requires_confirm,
                    'floor': str(st.get('floor', '')).strip(),
                    'station_type': station_type,
                    'status': st.get('status', 'UNVERIFIED'),
                    'zone': st.get('zone', ''),
                    'capacity': st.get('capacity', 50),
                    'directions': st.get('directions', ''),
                    'map_link': st.get('map_link') or st.get('maps_link') or '',
                    'latitude': lat if lat is not None else None,
                    'longitude': lng if lng is not None else None,
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

        if ambiguous_stations:
            self.stdout.write(self.style.WARNING(
                "\n[ATTENTION] The following station(s) require administrative block confirmation:"
            ))
            for amb in ambiguous_stations:
                self.stdout.write(self.style.WARNING(f"  • {amb}"))

