from django.db import migrations

def assign_superadmin_id(apps, schema_editor):
    User = apps.get_model('accounts', 'User')

    # If RNT-SUPER-001 is already assigned, nothing to do
    if User.objects.filter(admin_id__iexact='RNT-SUPER-001').exists():
        return

    # Find existing superuser who does not have an admin_id yet (e.g., created via createsuperuser)
    su = User.objects.filter(is_superuser=True, admin_id__isnull=True).order_by('id').first()
    if not su:
        su = User.objects.filter(is_superuser=True, admin_id='').order_by('id').first()

    if su:
        su.admin_id = 'RNT-SUPER-001'
        su.role = 'superadmin'
        su.is_staff = True
        su.save(update_fields=['admin_id', 'role', 'is_staff'])

def unassign_superadmin_id(apps, schema_editor):
    # No-op reverse to preserve data safety
    pass

class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_user_admin_id'),
    ]

    operations = [
        migrations.RunPython(assign_superadmin_id, reverse_code=unassign_superadmin_id),
    ]
