importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyCP4x_sr1PfSYnyBgLh5IxU6ikBM3j6A70",
    authDomain: "budgetbuddy-b31c0.firebaseapp.com",
    projectId: "budgetbuddy-b31c0",
    storageBucket: "budgetbuddy-b31c0.firebasestorage.app",
    messagingSenderId: "990232364571",
    appId: "1:990232364571:web:df12ea7b490381aeaddabe",
    measurementId: "G-M5B9D9Q6NE"
    });

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'BudgetBuddy Alert';
  const options = {
    body: payload.notification?.body || '',
  };
  self.registration.showNotification(title, options);
});