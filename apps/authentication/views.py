from django.shortcuts import render

# Create your views here.
from django.template.backends import django
from rest_framework import generics, status ,permissions
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import UserRegistrationSerializer, UserSerializer ,UserProfileSerializer ,ChangePasswordSerializer
from apps.profiles.models import Profile
from rest_framework.views import APIView
from apps.authentication.permissions import IsPremiumOrAdmin
from django.contrib.auth import get_user_model
from .permissions import IsAdminRole
from .serializers import AdminUserManagementSerializer
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError



class RegisterView(generics.CreateAPIView):
    serializer_class = UserRegistrationSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Send welcome email
        send_mail(
            subject="Welcome to BudgetBuddy!",
            message=(
                f"Hello {user.username},\n\n"
                "Welcome to BudgetBuddy!\n\n"
                "Your account has been successfully created. "
                "You can now manage your income, expenses, budgets, "
                "and savings goals in one place.\n\n"
                "Thank you for joining us!\n\n"
                "Regards,\n"
                "BudgetBuddy Team"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=True,
        )

        refresh = RefreshToken.for_user(user)

        return Response({
            'user': UserSerializer(user).data,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'message': 'User registered successfully.'
        }, status=status.HTTP_201_CREATED)


class UserProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile, _ = Profile.objects.get_or_create(user=request.user)
        serializer = UserProfileSerializer(profile)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        profile, _ = Profile.objects.get_or_create(user=request.user)
        serializer = UserProfileSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={'request': request}
        )

        if serializer.is_valid():
            request.user.set_password(
                serializer.validated_data['new_password']
            )
            request.user.save()

            # Send password change confirmation email
            send_mail(
                subject="BudgetBuddy - Password Changed Successfully",
                message=(
                    f"Hello {request.user.username},\n\n"
                    "Your BudgetBuddy account password was changed successfully.\n\n"
                    "If you did not make this change, please secure "
                    "your account immediately.\n\n"
                    "Regards,\n"
                    "BudgetBuddy Team"
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[request.user.email],
                fail_silently=True,
            )

            return Response(
                {"detail": "Password updated successfully."},
                status=status.HTTP_200_OK
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )



User = get_user_model()


class AdminUserListView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get(self, request):
        users = User.objects.all().order_by('-date_joined')
        serializer = AdminUserManagementSerializer(users, many=True)
        return Response({
            "stats": {
                "total_users": users.count(),
                "students": users.filter(role='STUDENT').count(),
                "premium": users.filter(role='PREMIUM').count(),
                "admins": users.filter(role='ADMIN').count(),
                "active": users.filter(is_active=True).count(),
            },
            "users": serializer.data,
        }, status=status.HTTP_200_OK)


class AdminUserDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def patch(self, request, pk):
        try:
            target_user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        if target_user.pk == request.user.pk:
            return Response(
                {"detail": "You cannot modify your own admin role or active status here."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = AdminUserManagementSerializer(target_user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

User = get_user_model()


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip().lower()

        if not email:
            return Response(
                {"detail": "Please provide your email address."},
                status=status.HTTP_400_BAD_REQUEST
            )

        users = User.objects.filter(email__iexact=email, is_active=True)

        # Return the same message whether the email exists or not.
        # This prevents revealing registered email addresses.
        if users.exists():
            user = users.first()

            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)

            frontend_url = getattr(
                settings,
                'FRONTEND_URL',
                'http://localhost:5173'
            )

            reset_link = (
                f"{frontend_url}/reset-password/{uid}/{token}"
            )

            send_mail(
                subject="BudgetBuddy - Reset Your Password",
                message=(
                    f"Hello {user.username},\n\n"
                    "Welcome to BudgetBuddy!\n\n"
                    "Your account has been successfully created. "
                    "You can now manage your income, expenses, "
                    "and savings goals in one place.\n\n"
                    "Regards,\n"
                    "BudgetBuddy Team"
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )

        return Response({
            "detail": "If an account exists with that email, "
                      "a password reset link has been sent."
        }, status=status.HTTP_200_OK)


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        uid = request.data.get('uid')
        token = request.data.get('token')
        new_password = request.data.get('new_password')
        confirm_password = request.data.get('confirm_password')

        if not all([uid, token, new_password, confirm_password]):
            return Response(
                {"detail": "All fields are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if new_password != confirm_password:
            return Response(
                {"detail": "Passwords do not match."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id, is_active=True)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response(
                {"detail": "Invalid or expired reset link."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not default_token_generator.check_token(user, token):
            return Response(
                {"detail": "Invalid or expired reset link."},
                status=status.HTTP_400_BAD_REQUEST
            )

        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError

        try:
            validate_password(new_password, user)
        except ValidationError as error:
            return Response(
                {"detail": list(error.messages)},
                status=status.HTTP_400_BAD_REQUEST
            )

        user.set_password(new_password)
        user.save()

        return Response(
            {"detail": "Password reset successfully. You can now log in."},
            status=status.HTTP_200_OK
        )