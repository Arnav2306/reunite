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
        parser.add_argument(
            '--reset-password',
            action='store_true',
            default=False,
            help="Securely reset password for an existing Super Admin account using hidden interactive prompt."
        )

    def _resolve_password(self, options, prompt_label="Enter password for initial Super Admin: "):
        password = options.get('password')
        if not password:
            password = os.environ.get('INITIAL_SUPERADMIN_PASSWORD') or os.environ.get('SUPERADMIN_PASSWORD')

        if not password:
            try:
                if sys.stdin.isatty():
                    p1 = getpass.getpass(prompt_label)
                    p2 = getpass.getpass("Confirm password: ")
                    if p1 != p2:
                        raise CommandError("Passwords do not match.")
                    password = p1
                else:
                    line = sys.stdin.readline().strip()
                    if line:
                        password = line
            except Exception as e:
                if isinstance(e, CommandError):
                    raise
                pass

        if not password or len(password.strip()) < 6:
            raise CommandError(
                "A secure password of at least 6 characters is required. "
                "Provide it via the INITIAL_SUPERADMIN_PASSWORD environment variable, "
                "the --password option, or an interactive terminal prompt."
            )
        return password.strip()

    def handle(self, *args, **options):
        admin_id = (options['admin_id'] or 'RNT-SUPER-001').strip()
        name = (options['name'] or 'Super Administrator').strip()
        email = options['email'].strip().lower() if options.get('email') else None
        reset_password = options.get('reset_password', False)

        # 1. Check if account with admin_id exists
        existing_user = User.objects.filter(admin_id__iexact=admin_id).first()
        if existing_user:
            if reset_password:
                new_password = self._resolve_password(options, f"Enter new password for Super Admin '{admin_id}': ")
                existing_user.set_password(new_password)
                existing_user.role = 'superadmin'
                existing_user.is_staff = True
                existing_user.is_superuser = True
                existing_user.is_active = True
                if email and not existing_user.email:
                    existing_user.email = email
                existing_user.save()

                try:
                    AuditLog.objects.create(
                        actor=existing_user,
                        action='SUPERADMIN_PASSWORD_RESET',
                        target_type='User',
                        target_id=str(existing_user.public_id),
                        details={
                            'admin_id': existing_user.admin_id,
                            'role': existing_user.role,
                            'note': 'Super Admin password securely reset via setup_initial_superadmin --reset-password',
                        }
                    )
                except Exception:
                    pass

                self.stdout.write(
                    self.style.SUCCESS(
                        f"[SUCCESS] Password for Super Admin '{admin_id}' has been securely reset.\n"
                        f"  - Admin ID: {existing_user.admin_id}\n"
                        f"  - Role: {existing_user.role}\n"
                        f"  - Staff: {existing_user.is_staff}\n"
                        f"  - Superuser: {existing_user.is_superuser}\n"
                        f"  - Active: {existing_user.is_active}\n"
                        f"  - Password Hash: updated securely via PBKDF2"
                    )
                )
                return
            else:
                self.stdout.write(
                    self.style.WARNING(
                        f"[ALREADY EXISTS] Super Admin account with Admin ID '{admin_id}' already exists "
                        f"(ID: {existing_user.id}, Role: {existing_user.role}, Active: {existing_user.is_active}). "
                        f"Duplicate creation skipped to preserve existing state. "
                        f"To securely reset its password, re-run with --reset-password."
                    )
                )
                return

        # 2. Check if an existing superuser matches --email
        if email:
            existing_by_email = User.objects.filter(email__iexact=email).first()
            if existing_by_email:
                if existing_by_email.is_superuser or existing_by_email.is_staff:
                    existing_by_email.admin_id = admin_id
                    existing_by_email.role = 'superadmin'
                    existing_by_email.is_staff = True
                    existing_by_email.is_superuser = True
                    existing_by_email.is_active = True
                    if reset_password:
                        new_pwd = self._resolve_password(options, f"Enter new password for Super Admin '{admin_id}': ")
                        existing_by_email.set_password(new_pwd)
                    existing_by_email.save()

                    self.stdout.write(
                        self.style.SUCCESS(
                            f"[SUCCESS] Linked Admin ID '{admin_id}' to existing Super Admin account '{email}'.\n"
                            f"  - Admin ID: {existing_by_email.admin_id}\n"
                            f"  - Email: {existing_by_email.email}\n"
                            f"  - Role: {existing_by_email.role}\n"
                            f"  - Active: {existing_by_email.is_active}"
                        )
                    )
                    return
                else:
                    raise CommandError(f"A non-staff user with email '{email}' already exists.")

        # 3. Create Super Admin with hashed password
        password = self._resolve_password(options)
        user = User(
            admin_id=admin_id,
            name=name,
            email=email,
            role='superadmin',
            is_staff=True,
            is_superuser=True,
            is_active=True,
        )
        user.set_password(password)
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
