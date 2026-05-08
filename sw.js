// Firebase Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyDKN78IhW8565_1C8c6yPhfxtp9ljxF4Xg",
    authDomain: "portal-das-escritoras.firebaseapp.com",
    projectId: "portal-das-escritoras",
    storageBucket: "portal-das-escritoras.firebasestorage.app",
    messagingSenderId: "84912612092",
    appId: "1:84912612092:web:19f720a022c12b5d8bed79"
});

const messaging = firebase.messaging();

// Lidar com mensagens em background (Obrigatório retornar a Promise no iOS!)
messaging.onBackgroundMessage((payload) => {
    console.log('[sw.js] Mensagem em background recebida:', payload);

    const { title, body, icon } = payload.notification || {};
    
    // O iOS exige que o Service Worker retorne a Promise, senão ele "mata" o processo antes de exibir a notificação
    return self.registration.showNotification(title || '📝 Portal das Escritoras', {
        body: body || 'Nova publicação no feed!',
        icon: icon || 'https://ui-avatars.com/api/?name=Portal&background=B31312&color=fff&size=192',
        badge: 'https://ui-avatars.com/api/?name=PE&background=B31312&color=fff&size=72',
        data: payload.data
    });
});

// Ao clicar na notificação, abrir o portal
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    if (event.action === 'close') return;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            for (const client of clientList) {
                if (client.url.includes('portal-escritoras') && 'focus' in client) {
                    return client.focus();
                }
            }
            return clients.openWindow('/');
        })
    );
});
