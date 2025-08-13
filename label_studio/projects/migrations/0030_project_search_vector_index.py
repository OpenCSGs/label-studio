from django.db import migrations, connection
from django.conf import settings
from core.redis import start_job_async_or_sync
from core.models import AsyncMigrationStatus
import logging

logger = logging.getLogger(__name__)
migration_name = '0030_project_search_vector_index'

# Actual DDL to run
def forward_migration(migration_name):
    migration = AsyncMigrationStatus.objects.create(
        name=migration_name,
        status=AsyncMigrationStatus.STATUS_STARTED,
    )
    logger.debug(f'Start async migration {migration_name}')
    
    # Check database backend and use appropriate SQL
    # PostgreSQL: Use CONCURRENTLY and specific index types (BRIN, GIN, etc.)
    sql = '''
    CREATE INDEX CONCURRENTLY IF NOT EXISTS project_search_vector_idx ON project USING GIN (search_vector);
    '''
    
    with connection.cursor() as cursor:
        cursor.execute(sql)
    
    migration.status = AsyncMigrationStatus.STATUS_FINISHED
    migration.save()
    logger.debug(f'Async migration {migration_name} complete')

# Reverse DDL
def reverse_migration(migration_name):
    migration = AsyncMigrationStatus.objects.create(
        name=migration_name,
        status=AsyncMigrationStatus.STATUS_STARTED,
    )
    logger.debug(f'Start async migration rollback {migration_name}')
    
    # Drop index (handle database differences)
    sql = 'DROP INDEX CONCURRENTLY IF EXISTS "project_search_vector_idx";'
    
    with connection.cursor() as cursor:
        cursor.execute(sql)
    
    migration.status = AsyncMigrationStatus.STATUS_FINISHED
    migration.save()
    logger.debug(f'Async migration rollback {migration_name} complete')

# Hook into Django migration
def forwards(apps, schema_editor):
    if connection.vendor == 'postgresql':
        start_job_async_or_sync(forward_migration, migration_name=migration_name)
    else:
        logger.debug(f'No index to create if is sqllite')

def backwards(apps, schema_editor):
    if connection.vendor == 'postgresql':
        start_job_async_or_sync(reverse_migration, migration_name=migration_name) 
    else:
        logger.debug(f'No index to drop if is sqllite')

class Migration(migrations.Migration):
    atomic = False
    dependencies = [
        ('projects', '0029_project_search_vector_and_more'),
    ]
    operations = [
        migrations.RunPython(forwards, backwards),
    ]