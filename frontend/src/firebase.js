import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { API_BASE_URL } from './services/api';
const firebaseConfig = {
  apiKey: "AIzaSyCP4x_sr1PfSYnyBgLh5IxU6ikBM3j6A70",
  authDomain: "budgetbuddy-b31c0.firebaseapp.com",
  projectId: "budgetbuddy-b31c0",
  storageBucket: "budgetbuddy-b31c0.firebasestorage.app",
  messagingSenderId: "990232364571",
  appId: "1:990232364571:web:df12ea7b490381aeaddabe",
  measurementId: "G-M5B9D9Q6NE"
};

const VAPID_KEY = "BAUTgilPBSvZsVUCUCV1g8UwGxQOYJjh5VxPQnNh_2UexpdrqoavT_0cyj6-x7fkusOnEos3nCtAbmkGJOaAXpA".trim();

async function getSafeMessaging() {
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY") {
    return null;
  }
  const supported = await isSupported();
  if (!supported) return null;

  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return getMessaging(app);
}

export async function requestAndRegisterFCMToken(authToken) {
  try {
    if (!('Notification' in window)) return;

    const messaging = await getSafeMessaging();
    if (!messaging) return;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const currentToken = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    if (currentToken && authToken) {
      const response = await fetch(`${API_BASE_URL}/notifications/register-fcm/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ fcm_token: currentToken }),
      });
      const data = await response.json().catch(() => ({}));
      console.log('[FCM] Register response:', response.status, data);
    }
  } catch (err) {
    console.error('[FCM] Registration error:', err);
  }
}

export function listenForForegroundMessages(onAlertReceived) {
  let unsubscribe = () => {};
  getSafeMessaging()
    .then((messaging) => {
      if (messaging) {
        unsubscribe = onMessage(messaging, (payload) => {
          if (onAlertReceived) onAlertReceived(payload);
        });
      }
    })
    .catch((err) => console.warn('[FCM] Foreground listener skipped:', err));

  return () => unsubscribe();
}