import factory
from core.utils.common import load_func
from django.conf import settings
from projects.models import Project, ProjectMember


class ProjectFactory(factory.django.DjangoModelFactory):
    title = factory.Faker('bs')
    description = factory.Faker('paragraph')
    organization = factory.SubFactory(load_func(settings.ORGANIZATION_FACTORY))
    created_by = factory.SelfAttribute('organization.created_by')
    is_published = True

    class Meta:
        model = Project

    @factory.post_generation
    def created_by_relationship(self, create, extracted, **kwargs):
        if not create or not self.created_by:
            return
        ProjectMember.objects.create(user=self.created_by, project=self)
