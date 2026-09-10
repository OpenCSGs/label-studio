import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('ml', '0007_auto_20240314_1957'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='mlbackend', name='created_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                                    related_name='created_ml_backends', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(model_name='mlbackend', name='seed_api_key_encrypted',
                            field=models.TextField(blank=True, default='')),
        migrations.AddField(model_name='mlbackend', name='entity_segment_access_key_encrypted',
                            field=models.TextField(blank=True, default='')),
        migrations.AddField(model_name='mlbackend', name='entity_segment_secret_key_encrypted',
                            field=models.TextField(blank=True, default='')),
        migrations.AddField(model_name='mlbackend', name='use_third_party_models',
                            field=models.BooleanField(default=False)),
    ]
