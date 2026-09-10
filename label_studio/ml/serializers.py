"""This file and its contents are licensed under the Apache License 2.0. Please see the included NOTICE for copyright information and LICENSE for a copy of the license.
"""
from core.utils.io import validate_upload_url
from django.conf import settings
from ml.models import MLBackend, MLBackendAuth
from rest_framework import serializers


class MLBackendSerializer(serializers.ModelSerializer):
    """
    Serializer for MLBackend model.
    """

    readable_state = serializers.SerializerMethodField()
    basic_auth_pass = serializers.CharField(write_only=True, required=False, allow_null=True, allow_blank=True)
    basic_auth_pass_is_set = serializers.SerializerMethodField()
    seed_api_key = serializers.CharField(write_only=True, required=False, allow_blank=True)
    entity_segment_access_key = serializers.CharField(write_only=True, required=False, allow_blank=True)
    entity_segment_secret_key = serializers.CharField(write_only=True, required=False, allow_blank=True)
    seed_api_key_is_set = serializers.SerializerMethodField()
    entity_segment_access_key_is_set = serializers.SerializerMethodField()
    entity_segment_secret_key_is_set = serializers.SerializerMethodField()

    def get_seed_api_key_is_set(self, obj):
        return bool(obj.seed_api_key_encrypted)

    def get_entity_segment_access_key_is_set(self, obj):
        return bool(obj.entity_segment_access_key_encrypted)

    def get_entity_segment_secret_key_is_set(self, obj):
        return bool(obj.entity_segment_secret_key_encrypted)

    def get_basic_auth_pass_is_set(self, obj):
        return bool(obj.basic_auth_pass)

    def get_readable_state(self, obj):
        return obj.get_state_display()

    def validate_basic_auth_pass(self, value):
        # Checks if the new password and old password are non-existent.
        if not value:
            if not self.instance.basic_auth_pass:
                raise serializers.ValidationError('Authentication password is required for Basic Authentication.')
            else:
                # If user is not changing the password, return the old password.
                return self.instance.basic_auth_pass
        return value

    def validate_url(self, value):
        validate_upload_url(value, block_local_urls=settings.ML_BLOCK_LOCAL_IP)

        return value

    def _validate_authentication(self, attrs):
        if attrs.get('auth_method') == MLBackendAuth.BASIC_AUTH:
            required_fields = ['basic_auth_user', 'basic_auth_pass']

            if any(field not in attrs for field in required_fields):
                raise serializers.ValidationError(
                    'Authentication username and password is required for Basic Authentication.'
                )

    def _validate_healthcheck(self, attrs):
        healthcheck_response = MLBackend.healthcheck_(**attrs)

        if healthcheck_response.is_error:
            if healthcheck_response.status_code == 401:
                message = (
                    'Able to connect to ML Server, but authentication parameters were '
                    'either not provided or are incorrect.'
                )
            else:
                message = (
                    f"Can't connect to ML backend {attrs['url']}, health check failed. "
                    'Make sure it is up and your firewall is properly configured. '
                    f'<a href="https://labelstud.io/guide/ml.html">Learn more</a> '
                    f'about how to set up an ML backend. Additional info: {healthcheck_response.error_message}'
                )

            raise serializers.ValidationError(message)

    def _validate_setup(self, attrs):
        request = self.context.get('request')
        token = MLBackend.get_user_jwt_token(getattr(request, 'user', None))
        setup_response = MLBackend.setup_(
            **attrs, ls_access_token=token
        )

        if setup_response.is_error:
            message = (
                f"Successfully connected to {attrs['url']} but it doesn't look like a valid ML backend. "
                f'Reason: {setup_response.error_message}.\n'
                'Check the ML backend server console logs to check the status.'
                'There might be something wrong with your model or it might be incompatible with the current labeling configuration.'
            )

            raise serializers.ValidationError(message)

    def validate(self, attrs):
        credentials = {
            name: attrs.pop(name, None)
            for name in ('seed_api_key', 'entity_segment_access_key', 'entity_segment_secret_key')
        }
        attrs = super().validate(attrs)

        request = self.context.get('request')
        try:
            MLBackend.get_user_jwt_token(getattr(request, 'user', None))
        except ValueError:
            raise serializers.ValidationError({'ls_api_key': 'LS_API_KEY_REQUIRED'})

        project = attrs.get('project', getattr(self.instance, 'project', None))
        label_config = project.label_config if project else ''
        requires_segment = '<BrushLabels' in label_config or '<PolygonLabels' in label_config
        use_third_party_models = attrs.get(
            'use_third_party_models',
            self.instance.use_third_party_models if self.instance else False,
        )
        if use_third_party_models and not credentials['seed_api_key'] and not (
            self.instance and self.instance.seed_api_key_encrypted
        ):
            raise serializers.ValidationError({'seed_api_key': 'Seed API Key is required.'})
        if use_third_party_models and requires_segment:
            if not credentials['entity_segment_access_key'] and not (
                self.instance and self.instance.entity_segment_access_key_encrypted
            ):
                raise serializers.ValidationError({'entity_segment_access_key': 'EntitySegment Access Key is required.'})
            if not credentials['entity_segment_secret_key'] and not (
                self.instance and self.instance.entity_segment_secret_key_encrypted
            ):
                raise serializers.ValidationError({'entity_segment_secret_key': 'EntitySegment Secret Key is required.'})

        self._validate_authentication(attrs)
        self._validate_healthcheck(attrs)
        self._validate_setup(attrs)
        attrs['_credentials'] = credentials
        return attrs

    def create(self, validated_data):
        credentials = validated_data.pop('_credentials', {})
        validated_data['created_by'] = self.context['request'].user
        instance = super().create(validated_data)
        return self._save_credentials(instance, credentials)

    def update(self, instance, validated_data):
        credentials = validated_data.pop('_credentials', {})
        if not instance.created_by_id:
            validated_data['created_by'] = self.context['request'].user
        instance = super().update(instance, validated_data)
        return self._save_credentials(instance, credentials)

    @staticmethod
    def _save_credentials(instance, credentials):
        fields = []
        for name, value in credentials.items():
            if value:
                field = f'{name}_encrypted'
                setattr(instance, field, MLBackend.encrypt_credential(value))
                fields.append(field)
        if fields:
            instance.save(update_fields=fields)
        return instance

    class Meta:
        model = MLBackend
        fields = [
            'id',
            'state',
            'readable_state',
            'is_interactive',
            'url',
            'error_message',
            'title',
            'auth_method',
            'basic_auth_user',
            'basic_auth_pass',
            'basic_auth_pass_is_set',
            'seed_api_key',
            'seed_api_key_is_set',
            'entity_segment_access_key',
            'entity_segment_access_key_is_set',
            'entity_segment_secret_key',
            'entity_segment_secret_key_is_set',
            'description',
            'use_third_party_models',
            'extra_params',
            'model_version',
            'timeout',
            'created_at',
            'updated_at',
            'auto_update',
            'project',
        ]


class MLInteractiveAnnotatingRequest(serializers.Serializer):
    """
    Serializer for ML interactive annotating request.
    """

    task = serializers.IntegerField(help_text='ID of task to annotate', required=True)
    context = serializers.JSONField(help_text='Context for ML model', allow_null=True, default=None)
