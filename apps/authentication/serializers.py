from rest_framework import serializers
from django.contrib.auth import get_user_model
from apps.profiles.models import Profile
from rest_framework import serializers
from apps.profiles.models import Profile

User = get_user_model()

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password', 'role')

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            role=validated_data.get('role', 'STUDENT')
        )
        Profile.objects.create(user=user)
        return user

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'role', 'created_at')






class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', required=False)
    email = serializers.EmailField(source='user.email', required=False)
    role = serializers.ChoiceField(
        source='user.role',
        choices=User.ROLE_CHOICES,
        required=False
    )
    monthly_income_baseline = serializers.DecimalField(
        source='monthly_income',
        max_digits=10,
        decimal_places=2,
        required=False
    )
    currency = serializers.CharField(required=False)
    alert_threshold_percent = serializers.IntegerField(min_value=50, max_value=99, required=False)
    monthly_report_notifications = serializers.BooleanField(required=False)

    class Meta:
        model = Profile
        fields = [
            'username',
            'email',
            'role',
            'monthly_income_baseline',
            'currency',
            'alert_threshold_percent',
            'monthly_report_notifications',
            'updated_at',
        ]

    def validate_username(self, value):
        user = self.instance.user
        if User.objects.exclude(pk=user.pk).filter(username=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate_email(self, value):
        user = self.instance.user
        if User.objects.exclude(pk=user.pk).filter(email=value).exists():
            raise serializers.ValidationError("This email address is already in use.")
        return value

    def to_representation(self, instance):
        data = super().to_representation(instance)
        prefs = instance.financial_preferences or {}
        data['currency'] = prefs.get('currency', 'INR')
        data['alert_threshold_percent'] = prefs.get('alert_threshold_percent', 80)
        data['monthly_report_notifications'] = prefs.get('monthly_report_notifications', True)
        return data

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        user = instance.user

        user_updated = False
        for attr in ('username', 'email', 'role'):
            if attr in user_data:
                setattr(user, attr, user_data[attr])
                user_updated = True
        if user_updated:
            user.save()

        if 'monthly_income' in validated_data:
            instance.monthly_income = validated_data['monthly_income']

        prefs = dict(instance.financial_preferences or {})
        for key in ('currency', 'alert_threshold_percent', 'monthly_report_notifications'):
            if key in validated_data:
                prefs[key] = validated_data[key]

        instance.financial_preferences = prefs
        instance.save()
        return instance


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, min_length=8, write_only=True)
    confirm_password = serializers.CharField(required=True, write_only=True)

    def validate_current_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "New passwords do not match."})
        if attrs['current_password'] == attrs['new_password']:
            raise serializers.ValidationError({"new_password": "New password must be different from the current password."})
        return attrs




class AdminUserManagementSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'is_active', 'date_joined']
        read_only_fields = ['id', 'username', 'email', 'date_joined']