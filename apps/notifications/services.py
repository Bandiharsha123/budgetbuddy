import logging
import os
import firebase_admin
from firebase_admin import credentials, messaging
from .models import Notification
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone
logger = logging.getLogger(__name__)


def _init_firebase():
    """Initializes the Firebase Admin app once if credentials exist."""
    if firebase_admin._apps:
        return True

    cred_path = os.getenv('FIREBASE_CREDENTIALS_PATH', 'firebase-service-account.json')
    if not os.path.exists(cred_path):
        logger.warning(f"Firebase credentials not found at {cred_path}; skipping FCM push.")
        return False

    try:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        return True
    except Exception as exc:
        logger.error(f"Firebase initialization failed: {exc}")
        return False


def send_fcm_push(user, title: str, body: str) -> bool:
    """Sends a browser push notification to the user's registered FCM token."""
    profile = getattr(user, 'profile', None)
    fcm_token = getattr(profile, 'fcm_token', None)

    if not fcm_token or not _init_firebase():
        return False

    message = messaging.Message(
        notification=messaging.Notification(
            title=f"BudgetBuddy: {title}",
            body=body,
        ),
        token=fcm_token,
    )

    try:
        messaging.send(message)
        return True
    except Exception as exc:
        logger.error(f"FCM push delivery failed for {user.username}: {exc}")
        return False


def dispatch_notification(
    user,
    notification_type: str,
    title: str,
    message: str,
    send_email: bool = True,
    send_push: bool = True,
    event_key: str = None,
    **kwargs,
):
    """
    Creates an in-app notification and dispatches email/push alerts.
    Uses event_key to prevent duplicate milestone notifications.
    """

    if event_key:
        notification, created = Notification.objects.get_or_create(
            event_key=event_key,
            defaults={
                "user": user,
                "notification_type": notification_type,
                "title": title,
                "message": message,
            },
        )
    else:
        notification = Notification.objects.create(
            user=user,
            notification_type=notification_type,
            title=title,
            message=message,
        )
        created = True

    # Retry failed emails, but never resend successful ones.
    if send_email and not notification.email_sent:
        email_success = send_email_notification(
            user=user,
            title=title,
            body=message,
        )

        if email_success:
            notification.email_sent = True
            notification.email_sent_at = timezone.now()
            notification.save(
                update_fields=["email_sent", "email_sent_at"]
            )

    # Push only when a notification is first created.
    if send_push and created:
        send_fcm_push(
            user=user,
            title=title,
            body=message,
        )

    return notification

def send_email_notification(user, title: str, body: str) -> bool:

    email = getattr(user, 'email', None)

    if not email:
        logger.warning("User has no email address.")
        return False

    try:
        context = {
            'username': user.username,
            'title': title,
            'message': body,
        }

        html_content = render_to_string(
            'notification/email/notification.html',
            context
        )

        email_message = EmailMultiAlternatives(
            subject=f"BudgetBuddy: {title}",
            body=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[email],
        )

        email_message.attach_alternative(
            html_content,
            "text/html"
        )

        email_message.send(fail_silently=False)

        logger.info(f"Email sent successfully to {email}")
        return True

    except Exception as exc:
        logger.exception(f"Email delivery failed: {exc}")
        return False