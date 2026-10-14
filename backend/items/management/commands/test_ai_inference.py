import os
import io
from PIL import Image, ImageDraw
from django.core.management.base import BaseCommand
from items.services.ai_description import (
    analyze_item_image,
    get_ai_configuration_status,
    call_gemini_vision,
    call_openai_vision
)

class Command(BaseCommand):
    help = 'Safely check and test live AI vision inference (Gemini primary, OpenAI fallback) without exposing credentials.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--image',
            type=str,
            help='Optional path to a test image file. If omitted, a synthetic test image is generated in-memory.'
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING("=== Reunite AI Vision Inference Diagnostic ==="))

        status_info = get_ai_configuration_status()
        self.stdout.write(f"Primary Provider:   {status_info['primary_provider'].upper()} (Model: {status_info['gemini_model']})")
        self.stdout.write(f"Fallback Provider:  {status_info['fallback_provider'].upper()} (Model: {status_info['openai_model']})")
        self.stdout.write(f"GEMINI_API_KEY:     {'[CONFIGURED]' if status_info['gemini_configured'] else '[NOT SET]'}")
        self.stdout.write(f"OPENAI_API_KEY:     {'[CONFIGURED]' if status_info['openai_configured'] else '[NOT SET]'}")

        # Prepare test image
        img_path = options.get('image')
        if img_path and os.path.exists(img_path):
            self.stdout.write(f"\nUsing provided test image: {img_path}")
            with open(img_path, 'rb') as f:
                img_io = io.BytesIO(f.read())
                img_io.name = os.path.basename(img_path)
                img_io.content_type = 'image/jpeg'
        else:
            self.stdout.write("\nGenerating safe synthetic test image (blue notebook)...")
            img = Image.new('RGB', (300, 300), color=(30, 90, 180))
            draw = ImageDraw.Draw(img)
            draw.rectangle([40, 40, 260, 260], fill=(220, 220, 220), outline=(20, 20, 20))
            draw.text((60, 120), "Student Notes", fill=(0, 0, 0))
            img_io = io.BytesIO()
            img.save(img_io, format='JPEG')
            img_io.seek(0)
            img_io.name = 'test_notebook.jpg'
            img_io.content_type = 'image/jpeg'

        self.stdout.write("\nAttempting full pipeline inference (with fallback)...")
        result = analyze_item_image(img_io)

        if result['available']:
            self.stdout.write(self.style.SUCCESS(
                f"[SUCCESS] AI Inference succeeded via: {result.get('provider', 'Unknown').upper()}"
            ))
            s = result['suggestion']
            self.stdout.write(f"  • Category:   {s.get('category')}")
            self.stdout.write(f"  • Title:      {s.get('suggested_title')}")
            self.stdout.write(f"  • Color:      {s.get('primary_color')}")
            self.stdout.write(f"  • Confidence: {s.get('confidence')}")
            self.stdout.write(f"  • Risk Tier:  {s.get('risk_tier')} ({'Valuable' if s.get('risk_tier') == 1 else 'General'})")
            self.stdout.write(f"  • Details:    {result.get('detail')}")
        else:
            self.stdout.write(self.style.WARNING(
                f"[NOTICE] Live AI inference returned: {result.get('detail')}"
            ))
            self.stdout.write("  -> Manual entry fallback is ACTIVE and fully functional.")

        self.stdout.write(self.style.MIGRATE_HEADING("================================================"))
