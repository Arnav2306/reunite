import os
import sys
import getpass
from django.core.management.base import BaseCommand, CommandError
from accounts.models import User
from audit.models import AuditLog


class Command(BaseCommand):
    help = (
        "Idempotently set up the initial Super Admin account for live Admin Portal access. "
        "Stores only the secure password hash via set_password()."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--admin-id',
            type=str,
            default='RNT-SUPER-001',
            help="Alphanumeric Admin ID for the Super Admin account (default: RNT-SUPER-001)."
        )
        parser.add_argument(
            '--password',
            type=str,
            default=None,
            help="Password for the account. If omitted, checks INITIAL_SUPERADMIN_PASSWORD env var or prompts."
        )
        parser.add_argument(
            '--name',
            type=str,
            default='Super Administrator',
            help="Full display name for the Super Admin (default: Super Administrator)."
        )
        parser.add_argument(
            '--email',
            type=str,
            default=None,
            help="Optional contact email for the Super Admin (default: None)."
        )

    def handle(self, *args, **options):
        admin_id = (options['admin_id'] or 'RNT-SUPER-001').strip()
        name = (options['name'] or 'Super Administrator').strip()
        email = options['email'].strip().lower() if options.get('email') else None

        # 1. Check for duplicate account
        existing_user = User.objects.filter(admin_id__iexact=admin_id).first()
        if existing_user:
            self.stdout.write(
                self.style.WARNING(
                    f"[ALREADY EXISTS] Super Admin account with Admin ID '{admin_id}' already exists "
                    f"(ID: {existing_user.id}, Role: {existing_user.role}, Active: {existing_user.is_active}). "
                    f"Duplicate creation skipped to preserve existing state."
                )
            )
            return

        # Also check if email is provided and already taken
        if email and User.objects.filter(email__iexact=email).exists():
            raise CommandError(f"A user with email '{email}' already exists.")

        # 2. Resolve password securely (CLI flag -> env var -> interactive prompt)
        password = options.get('password')
        if not password:
            password = os.environ.get('INITIAL_SUPERADMIN_PASSWORD') or os.environ.get('SUPERADMIN_PASSWORD')

        if not password and sys.stdin.isatty():
            password = getpass.getpass("Enter password for initial Super Admin: ")
            confirm = getpass.getpass("Confirm password: ")
            if password != confirm:
                raise CommandError("Passwords do not match.")

        if not password or len(password.strip()) < 6:
            raise CommandError(
                "A secure password of at least 6 characters is required. "
                "Provide it via the INITIAL_SUPERADMIN_PASSWORD environment variable, "
                "the --password option, or an interactive terminal prompt."
            )

        # 3. Create Super Admin with hashed password
        user = User(
            admin_id=admin_id,
            name=name,
            email=email,
            role='superadmin',
            is_staff=True,
            is_superuser=True,
            is_active=True,
        )
        user.set_password(password.strip())
        user.save()

        # 4. Record audit log entry
        try:
            AuditLog.objects.create(
                actor=user,
                action='SUPERADMIN_INITIAL_SETUP',
                target_type='User',
                target_id=str(user.public_id),
                details={
                    'admin_id': user.admin_id,
                    'name': user.name,
                    'role': user.role,
                    'is_staff': user.is_staff,
                    'is_superuser': user.is_superuser,
                    'note': 'Initial Super Admin account provisioned via setup_initial_superadmin command',
                }
            )
        except Exception:
            pass

        self.stdout.write(
            self.style.SUCCESS(
                f"[SUCCESS] Initial Super Admin account created successfully.\n"
                f"  - Admin ID: {user.admin_id}\n"
                f"  - Role: {user.role}\n"
                f"  - Staff: {user.is_staff}\n"
                f"  - Superuser: {user.is_superuser}\n"
                f"  - Active: {user.is_active}\n"
                f"  - Password Hash: stored securely via PBKDF2 (plaintext never logged or stored)"
            )
        )
