class CafeApp {
    constructor() {
        this.stamps = Math.min(6, Math.max(0, Number.parseInt(localStorage.getItem('cafe_stamps') || '0', 10) || 0));
        this.cart = [];
        this.currentCategory = 'all';
        this.searchTerm = '';
        this.menu = [
            { id: 1, name: 'إسبريسو مكياتو فاخر', desc: 'قهوة مركزة تعدل المزاج برغوة ناعمة تروق الراس', price: 1500, category: 'hot' },
            { id: 2, name: 'شاي كرك عدني أصلي', desc: 'على اصولد بالهيل والبهارات اللي تضبط الدماغ', price: 1000, category: 'hot' },
            { id: 3, name: 'قهوة تركي مضبوطة', desc: 'وجهها مضبوط وطعمها يرجع لك روقانك', price: 1200, category: 'hot' },
            { id: 4, name: 'آيس الجود لاتيه', desc: 'مشروبنا البارد المخصوص اللي يبرد على القلب', price: 3000, category: 'cold' },
            { id: 5, name: 'موهيتو نكهات منعش', desc: 'نعناع وليمون طازج يصحصحك من الآخر', price: 2000, category: 'cold' },
            { id: 6, name: 'آيس سبانيش لاتيه', desc: 'حليب بارد مع إسبريسو ولمسة حلا لذيذة', price: 3200, category: 'cold' },
            { id: 7, name: 'تشيز كيك التوت البلدي', desc: 'طازج وبارد يذوب بالفم ذوبان', price: 2500, category: 'dessert' },
            { id: 8, name: 'كيكة الشوكولاتة البلجيكية', desc: 'غرقانة صوص دافئ ومقرمشة تفتح النفس', price: 3500, category: 'dessert' }
        ];
        this.cart = this.restoreCart();
        this.deferredPrompt = null;
        // Coordinates remain unset until the cafe's verified map pin is supplied.
        this.cafeLocation = window.ALJOUD_CAFE_LOCATION || null;
        this.proximityWatchId = null;
        this.proximityInside = false;
        this.notificationRegistration = null;
        this.webPushRegistration = null;
        this.webPushVerified = false;
        this.messaging = null;
        this.fcmToken = localStorage.getItem('aljoud_fcm_token') || null;
        this.notificationSubscriptionVerified = false;
        this.notificationVerificationInProgress = false;
        this.init();
    }

    init() {
        this.initTheme();
        this.renderMenu();
        this.updateCartUI();
        this.updateLoyaltyUI();
        this.setTodayQRBadge();
        this.setupPWAInstaller();
        this.setupModalInteractions();
        this.setupOrderDetails();
        this.setupNotifications();
        this.registerServiceWorker();
    }

    setupModalInteractions() {
        const modalIds = ['customAlertModal', 'cartModal', 'loyaltyModal', 'contactModal', 'moodModal'];

        // إغلاق النافذة عند الضغط على الخلفية، دون إغلاقها عند الضغط داخل محتواها.
        modalIds.forEach((id) => {
            const modal = document.getElementById(id);
            if (!modal) return;

            modal.addEventListener('click', (event) => {
                if (event.target === modal) {
                    modal.classList.add('hidden');
                }
            });
        });

        // زر Escape يغلق أعلى نافذة ظاهرة فقط.
        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;

            const visibleModal = modalIds
                .map((id) => document.getElementById(id))
                .find((modal) => modal && !modal.classList.contains('hidden'));

            if (visibleModal) visibleModal.classList.add('hidden');
        });
    }

    setupNotifications() {
        document.getElementById('enableNotificationsBtn')?.addEventListener('click', () => this.enableWebPushNotifications());
        document.getElementById('enableNearbyBtn')?.addEventListener('click', () => this.enableNearbyAlerts());
        document.getElementById('copyFcmTokenBtn')?.addEventListener('click', () => this.copyFcmToken());
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') this.stopProximityMonitoring();
            else if (localStorage.getItem('aljoud_nearby_enabled') === 'true') this.startProximityMonitoring();
        });
        this.updateNotificationStatus();
        if ('Notification' in window && Notification.permission === 'granted' && this.fcmToken) {
            this.showFcmTokenControl();
        }
    }

    async verifyFcmSubscription() {
        if (this.notificationVerificationInProgress || !('Notification' in window) || Notification.permission !== 'granted') return false;
        this.notificationVerificationInProgress = true;
        this.notificationSubscriptionVerified = false;
        this.updateNotificationStatus();

        try {
            const registration = this.notificationRegistration || await navigator.serviceWorker.ready;
            this.notificationRegistration = registration;
            const messaging = await this.initializeFirebaseMessaging();
            const currentToken = await messaging.getToken({
                vapidKey: window.ALJOUD_VAPID_PUBLIC_KEY,
                serviceWorkerRegistration: registration
            });
            if (!currentToken || currentToken !== this.fcmToken) {
                this.fcmToken = currentToken || null;
                if (currentToken) localStorage.setItem('aljoud_fcm_token', currentToken);
                else localStorage.removeItem('aljoud_fcm_token');
                this.notificationSubscriptionVerified = false;
                return false;
            }

            const auth = firebase.auth();
            if (!auth.currentUser) await auth.signInAnonymously();
            const user = auth.currentUser;
            if (!user) throw new Error('تعذر التحقق من هوية الجهاز في Firebase.');

            const snapshot = await firebase.firestore()
                .collection('notificationSubscriptions')
                .doc(user.uid)
                .get();
            const saved = snapshot.exists ? snapshot.data() : null;
            this.notificationSubscriptionVerified = Boolean(saved && saved.enabled === true && saved.token === currentToken);
            return this.notificationSubscriptionVerified;
        } catch (error) {
            console.warn('Could not verify the saved FCM subscription:', error);
            this.notificationSubscriptionVerified = false;
            return false;
        } finally {
            this.notificationVerificationInProgress = false;
            this.updateNotificationStatus();
        }
    }

    installFirebaseFetchDiagnostics() {
        // Capture the exact Firebase endpoint that fails during Android FCM registration.
        // This is diagnostic only: requests and responses are not modified.
        if (this.firebaseFetchDiagnosticsInstalled || typeof window.fetch !== 'function') return;
        this.firebaseFetchDiagnosticsInstalled = true;
        this.lastFirebaseRequestFailure = null;
        const originalFetch = window.fetch.bind(window);
        window.fetch = async (...args) => {
            const requestUrl = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
            const isFirebaseRequest = requestUrl.includes('firebaseinstallations.googleapis.com') || requestUrl.includes('fcmregistrations.googleapis.com') || requestUrl.includes('googleapis.com/v1/projects');
            try {
                const response = await originalFetch(...args);
                if (isFirebaseRequest && !response.ok) {
                    this.lastFirebaseRequestFailure = `HTTP ${response.status} — ${requestUrl}`;
                    console.error('[AlJoud FCM request failed]', this.lastFirebaseRequestFailure);
                }
                return response;
            } catch (error) {
                if (isFirebaseRequest) {
                    this.lastFirebaseRequestFailure = `Network failure — ${requestUrl}`;
                    console.error('[AlJoud FCM network failure]', this.lastFirebaseRequestFailure, error);
                }
                throw error;
            }
        };
    }

    async initializeFirebaseMessaging() {
        if (this.messaging) return this.messaging;
        if (!window.firebase || !window.ALJOUD_FIREBASE_CONFIG || !window.ALJOUD_VAPID_PUBLIC_KEY) {
            throw new Error('Firebase web configuration is missing.');
        }
        if (!firebase.apps.length) firebase.initializeApp(window.ALJOUD_FIREBASE_CONFIG);
        const supported = await firebase.messaging.isSupported();
        if (!supported) throw new Error('This browser does not support Firebase Web Messaging.');
        this.messaging = firebase.messaging();
        this.messaging.onMessage(async (payload) => {
            const notification = payload.notification || payload.data || {};
            const registration = this.notificationRegistration || await navigator.serviceWorker.ready;
            await registration.showNotification(notification.title || 'الجود كافيه ☕', {
                body: notification.body || 'عندنا شيء حلو نحب نشاركه معك ❤️',
                icon: notification.icon || './logo.png',
                badge: './logo.png',
                tag: notification.tag || 'aljoud-foreground',
                data: { url: notification.url || './index.html' }
            });
        });
        return this.messaging;
    }

    async saveFcmSubscription(token) {
        if (!window.firebase || !firebase.auth || !firebase.firestore) {
            throw new Error('Firebase Auth or Firestore SDK is not loaded.');
        }

        const auth = firebase.auth();
        if (!auth.currentUser) {
            await auth.signInAnonymously();
        }
        const user = auth.currentUser;
        if (!user) throw new Error('Anonymous Firebase sign-in did not return a user.');

        const db = firebase.firestore();
        const subscriptionRef = db.collection('notificationSubscriptions').doc(user.uid);
        const existing = await subscriptionRef.get();
        const timestamp = firebase.firestore.FieldValue.serverTimestamp();

        await subscriptionRef.set({
            token,
            enabled: true,
            source: 'web',
            createdAt: existing.exists && existing.data().createdAt
                ? existing.data().createdAt
                : timestamp,
            updatedAt: timestamp
        }, { merge: true });

        return user.uid;
    }

    showFcmTokenControl() {
        const button = document.getElementById('copyFcmTokenBtn');
        if (button) button.classList.remove('hidden');
    }

    async copyFcmToken() {
        if (!this.fcmToken) return;
        try {
            await navigator.clipboard.writeText(this.fcmToken);
            this.showAlert('تم نسخ رمز الجهاز', 'هذا الرمز مخصص لاختبار إرسال إشعار لهذا الجهاز. لا تنشره أو تشاركه علنًا.', 'success');
        } catch (error) {
            this.showAlert('تعذر النسخ', 'انسخ الرمز من أدوات المطور عند الحاجة، ولا تنشره علنًا.', 'error');
        }
    }

    updateNotificationStatus() {
        const status = document.getElementById('notificationStatus');
        const enableButton = document.getElementById('enableNotificationsBtn');
        const nearbyButton = document.getElementById('enableNearbyBtn');
        if (!status) return;

        if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
            status.textContent = 'هذا المتصفح لا يدعم إشعارات الويب.';
            if (enableButton) enableButton.disabled = true;
            if (nearbyButton) nearbyButton.disabled = true;
            return;
        }

        if (Notification.permission === 'granted') {
            if (this.webPushVerified) {
                status.textContent = 'تم تسجيل هذا الجهاز في نظام إشعارات الجود الجديد بنجاح.';
            } else {
                status.textContent = 'الإذن مسموح. اضغط لتسجيل هذا الجهاز في نظام إشعارات الجود.';
            }
            if (enableButton) enableButton.textContent = this.webPushVerified ? 'الإشعارات مسجلة ✓' : 'تحقق / فعّل الإشعارات';
        } else if (Notification.permission === 'denied') {
            status.textContent = 'الإشعارات محظورة من إعدادات المتصفح. يمكنك تغيير الإذن من إعدادات الموقع.';
        } else {
            status.textContent = 'فعّل الإشعارات لتستقبل رسائل الجود على هذا الجهاز.';
        }

        if (nearbyButton) {
            nearbyButton.disabled = !this.cafeLocation || Notification.permission !== 'granted';
            nearbyButton.textContent = this.cafeLocation ? 'فعّل تنبيه الاقتراب (300م)' : 'تنبيه الاقتراب — بانتظار موقع الكافي';
        }
    }

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const raw = atob(base64);
        return Uint8Array.from(raw, (char) => char.charCodeAt(0));
    }

    async enableWebPushNotifications() {
        if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
            this.showAlert('الإشعارات غير مدعومة', 'افتح الموقع من متصفح حديث يدعم Web Push.', 'info');
            return;
        }

        try {
            const permission = Notification.permission === 'default'
                ? await Notification.requestPermission()
                : Notification.permission;

            if (permission !== 'granted') {
                this.updateNotificationStatus();
                this.showAlert('لم يتم تفعيل الإشعارات', 'اسمح بالإشعارات من إعدادات المتصفح ثم أعد المحاولة.', 'info');
                return;
            }

            const publicKey = window.ALJOUD_WEB_PUSH_VAPID_PUBLIC_KEY;
            if (!publicKey) throw new Error('Web Push public key is missing.');

            // Keep the new Web Push subscription isolated from the existing Firebase worker.
            const registration = await navigator.serviceWorker.register('./webpush/push-sw.js', {
                scope: './webpush/'
            });
            this.webPushRegistration = registration;

            const activeWorker = registration.installing || registration.waiting || registration.active;
            if (activeWorker && activeWorker.state !== 'activated') {
                await new Promise((resolve, reject) => {
                    const onStateChange = () => {
                        if (activeWorker.state === 'activated') {
                            activeWorker.removeEventListener('statechange', onStateChange);
                            resolve();
                        } else if (activeWorker.state === 'redundant') {
                            activeWorker.removeEventListener('statechange', onStateChange);
                            reject(new Error('Web Push service worker became redundant.'));
                        }
                    };
                    activeWorker.addEventListener('statechange', onStateChange);
                    onStateChange();
                });
            }

            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this.urlBase64ToUint8Array(publicKey)
                });
            }

            const response = await fetch('https://aljoud-push-api.ese37522.workers.dev/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(subscription.toJSON())
            });

            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.success) {
                throw new Error(result.error || `Subscription API returned HTTP ${response.status}`);
            }

            this.webPushVerified = true;
            this.updateNotificationStatus();
            await registration.showNotification('يا هلا بك في الجود ☕', {
                body: 'تم تسجيل جهازك لاستقبال إشعارات الجود ❤️',
                icon: '../logo.png',
                badge: '../logo.png',
                tag: 'aljoud-webpush-welcome',
                data: { url: '../index.html' }
            });
            this.showAlert('تم تفعيل إشعارات الجود ❤️', 'تم تسجيل هذا الجهاز وحفظ اشتراكه في نظام الإشعارات الجديد بنجاح.', 'success');
        } catch (error) {
            console.error('AlJoud Web Push subscription failed:', error);
            this.webPushVerified = false;
            this.updateNotificationStatus();
            this.showAlert(
                'تعذر تسجيل الإشعارات',
                `التفاصيل: ${String(error?.message || error).slice(0, 220)}
إذا استمر الخطأ، أرسل نصه كما ظهر.`,
                'error'
            );
        }
    }

    async enableNotifications() {
        if (!('Notification' in window) || !('serviceWorker' in navigator)) {
            this.showAlert('الإشعارات غير مدعومة', 'افتح الموقع من متصفح حديث يدعم إشعارات الويب.', 'info');
            return;
        }
        let diagnosticStage = 'التحقق من إذن الإشعارات';
        try {
            const permission = Notification.permission === 'default'
                ? await Notification.requestPermission()
                : Notification.permission;
            if (permission !== 'granted') {
                this.updateNotificationStatus();
                this.showAlert('لم يتم تفعيل الإشعارات', 'يمكنك السماح بها من إعدادات المتصفح ثم المحاولة مرة أخرى.', 'info');
                return;
            }

            diagnosticStage = 'انتظار Service Worker';
            const registration = this.notificationRegistration || await navigator.serviceWorker.ready;
            this.notificationRegistration = registration;
            diagnosticStage = 'تهيئة Firebase Messaging والتحقق من دعم المتصفح';
            const messaging = await this.initializeFirebaseMessaging();
            diagnosticStage = 'طلب رمز الإشعارات من Firebase (FCM)';
            this.installFirebaseFetchDiagnostics();
            const token = await messaging.getToken({
                vapidKey: window.ALJOUD_VAPID_PUBLIC_KEY,
                serviceWorkerRegistration: registration
            });
            if (!token) throw new Error('Firebase did not return a messaging token.');

            // Keep the device token locally for this browser. A secure backend
            // is still required before this device can join remote campaigns.
            diagnosticStage = 'حفظ رمز الجهاز محليًا';
            this.fcmToken = token;
            localStorage.setItem('aljoud_fcm_token', token);
            this.showFcmTokenControl();

            // Store this device's subscription under its anonymous Firebase UID.
            try {
                diagnosticStage = 'تسجيل الدخول المجهول وحفظ الاشتراك في Firestore';
                await this.saveFcmSubscription(token);
                this.notificationSubscriptionVerified = true;
            } catch (saveError) {
                console.error('Could not save FCM subscription to Firestore:', saveError);
                this.updateNotificationStatus();
                this.showAlert(
                    'الإشعارات تعمل لكن لم يُحفظ الاشتراك',
                    'تم إنشاء رمز الجهاز، لكن تعذر حفظه في قاعدة البيانات. تحقق من تفعيل Anonymous Authentication وقواعد Firestore ثم أعد المحاولة.',
                    'error'
                );
                return;
            }

            await registration.showNotification('يا هلا بك في الجود ☕', {
                body: 'تم تفعيل استقبال إشعارات الجود على هذا الجهاز ❤️',
                icon: './logo.png', badge: './logo.png', tag: 'aljoud-welcome',
                data: { url: './index.html' }
            });
            this.updateNotificationStatus();
            this.showAlert('تم تفعيل إشعارات الجود وحفظ الاشتراك ❤️', 'تم حفظ اشتراك هذا الجهاز بأمان في قاعدة بيانات الجود. يمكنك إغلاق الموقع؛ أما إرسال الحملات العامة فسنجهز له خادمًا آمنًا في الخطوة التالية.', 'success');
        } catch (error) {
            console.error('Firebase Messaging setup failed:', {
                code: error?.code || 'unknown',
                message: error?.message || String(error),
                name: error?.name || 'Error'
            });

            const code = error?.code || '';
            const requestFailure = this.lastFirebaseRequestFailure ? `\\nالطلب المتعثر: ${this.lastFirebaseRequestFailure}` : '';
            const detail = (error?.message || String(error)) + requestFailure;
            let guidance = 'أرسل لنا رمز الخطأ والتفاصيل الظاهرة أدناه حتى نحدد السبب بدقة.';
            if (code.includes('unsupported-browser')) {
                guidance = 'افتح الموقع في Google Chrome أو متصفح Android يدعم Web Push، وليس داخل متصفح واتساب أو إنستغرام.';
            } else if (code.includes('permission')) {
                guidance = 'تحقق من إذن الإشعارات للموقع من إعدادات Chrome في الجوال.';
            } else if (code.includes('service-worker')) {
                guidance = 'تعذر تشغيل ملف خدمة الإشعارات. سنحتاج فحص تسجيل Service Worker لهذا المتصفح.';
            } else if (code.includes('token-subscribe') || code.includes('installations')) {
                guidance = 'تعذر تسجيل الجهاز لدى Firebase. تحقق من اتصال الإنترنت وإعدادات Firebase لهذا النطاق.';
            } else if (code.includes('api-key-not-valid') || detail.toLowerCase().includes('api key not valid')) {
                guidance = 'رفض Firebase مفتاح API لهذا الطلب. سنراجع النطاق وقيود مفتاح API بدل تغييره عشوائيًا.';
            }

            const safeDetail = String(detail).slice(0, 240);
            this.showAlert(
                'تعذر إكمال ربط الإشعارات',
                `المرحلة: ${diagnosticStage}\nرمز الخطأ: ${code || 'غير محدد'}\nالتفاصيل: ${safeDetail}\n\n${guidance}`,
                'error'
            );
        }
    }

    enableNearbyAlerts() {
        if (!this.cafeLocation || !Number.isFinite(this.cafeLocation.lat) || !Number.isFinite(this.cafeLocation.lng)) {
            this.showAlert('نحتاج موقع الكافي أولًا', 'أرسل رابط موقع الجود على خرائط Google حتى نحدد نطاق الاقتراب بدقة.', 'info');
            return;
        }
        if (!('geolocation' in navigator) || Notification.permission !== 'granted') {
            this.showAlert('تحقق من الإعدادات', 'نحتاج دعم تحديد الموقع والسماح بإشعارات الجود أولًا.', 'info');
            return;
        }
        localStorage.setItem('aljoud_nearby_enabled', 'true');
        this.startProximityMonitoring();
        this.showAlert('تم تفعيل تنبيه الاقتراب', 'عندما يكون الموقع مفتوحًا وتكون داخل نطاق 300 متر، سنرحّب بك بإشعار لطيف. لا نتابع موقعك عند إغلاق الصفحة.', 'success');
    }

    startProximityMonitoring() {
        if (!this.cafeLocation || !('geolocation' in navigator) || Notification.permission !== 'granted' ||
            localStorage.getItem('aljoud_nearby_enabled') !== 'true' || document.visibilityState === 'hidden' || this.proximityWatchId !== null) return;
        this.proximityWatchId = navigator.geolocation.watchPosition((position) => {
            const distance = this.getDistanceMeters(position.coords.latitude, position.coords.longitude, this.cafeLocation.lat, this.cafeLocation.lng);
            if (distance <= 300 && !this.proximityInside) {
                this.proximityInside = true;
                this.sendNearbyNotification();
            } else if (distance > 350) {
                this.proximityInside = false;
            }
        }, (error) => {
            console.warn('Nearby location unavailable:', error.message);
            this.stopProximityMonitoring();
            const status = document.getElementById('notificationStatus');
            if (status) status.textContent = 'تعذر الوصول لموقعك. تحقق من إذن الموقع وإعدادات GPS.';
        }, { enableHighAccuracy: false, maximumAge: 15000, timeout: 12000 });
    }

    stopProximityMonitoring() {
        if (this.proximityWatchId !== null && 'geolocation' in navigator) {
            navigator.geolocation.clearWatch(this.proximityWatchId);
            this.proximityWatchId = null;
        }
    }

    getDistanceMeters(lat1, lon1, lat2, lon2) {
        const radians = (degrees) => degrees * Math.PI / 180;
        const radius = 6371000;
        const dLat = radians(lat2 - lat1), dLon = radians(lon2 - lon1);
        const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
        return 2 * radius * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
    }

    async sendNearbyNotification() {
        try {
            const registration = this.notificationRegistration || await navigator.serviceWorker.ready;
            await registration.showNotification('الجود قريب منك ❤️', {
                body: 'أنت قريب علينا، وإحنا مشتاقين لك ☕',
                icon: './logo.png', badge: './logo.png', tag: 'aljoud-nearby',
                data: { url: './index.html' }
            });
        } catch (error) { console.warn('Could not show nearby notification:', error); }
    }

    registerServiceWorker() {
        if (!('serviceWorker' in navigator)) return;

        // لا نعيد تحميل الصفحة عند أول تثبيت؛ نحدّثها فقط عند وصول نسخة جديدة.
        let hasControlledPage = Boolean(navigator.serviceWorker.controller);

        navigator.serviceWorker.register('./sw.js')
            .then((registration) => {
                this.notificationRegistration = registration;
                this.updateNotificationStatus();
                const checkForUpdates = () => {
                    if (document.visibilityState === 'visible') {
                        registration.update().catch(err => console.log('SW Update Error: ', err));
                    }
                };

                // فحص التحديثات دوريًا، دون تحديث الصفحة لمجرد مرور الوقت.
                window.setInterval(checkForUpdates, 60000);
                document.addEventListener('visibilitychange', checkForUpdates);

                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    if (!hasControlledPage) {
                        // نتجاهل أول تحكم عند تثبيت التطبيق لأول مرة.
                        hasControlledPage = true;
                        return;
                    }

                    if (!this.swRefreshing) {
                        this.swRefreshing = true;
                        window.location.reload();
                    }
                });
            })
            .catch(err => console.log('SW Error: ', err));
    }

    restoreCart() {
        try {
            const savedCart = JSON.parse(localStorage.getItem('cafe_cart') || '[]');
            if (!Array.isArray(savedCart)) return [];

            // نستخدم بيانات المنتج الحالية من المنيو بدل الاحتفاظ بسعر قديم مخزن.
            return savedCart.map(savedItem => {
                const currentItem = this.menu.find(item => item.id === Number(savedItem.id));
                const qty = Math.floor(Number(savedItem.qty));
                return currentItem && qty > 0
                    ? { ...currentItem, qty: Math.min(qty, 99) }
                    : null;
            }).filter(Boolean);
        } catch (error) {
            console.warn('Could not restore cart:', error);
            return [];
        }
    }

    initTheme() {
        const savedTheme = localStorage.getItem('cafe_theme') || 'light';
        if (savedTheme === 'light') {
            document.documentElement.classList.remove('dark');
            document.getElementById('themeIcon').className = "fa-solid fa-sun text-sm";
            document.getElementById('themeColorMeta').setAttribute('content', '#f8fafc');
        } else {
            document.documentElement.classList.add('dark');
            document.getElementById('themeIcon').className = "fa-solid fa-moon text-sm";
            document.getElementById('themeColorMeta').setAttribute('content', '#121110');
        }
    }

    toggleTheme() {
        const isDark = document.documentElement.classList.contains('dark');
        if (isDark) {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('cafe_theme', 'light');
            document.getElementById('themeIcon').className = "fa-solid fa-sun text-sm";
            document.getElementById('themeColorMeta').setAttribute('content', '#f8fafc');
        } else {
            document.documentElement.classList.add('dark');
            localStorage.setItem('cafe_theme', 'dark');
            document.getElementById('themeIcon').className = "fa-solid fa-moon text-sm";
            document.getElementById('themeColorMeta').setAttribute('content', '#121110');
        }
    }

    setupPWAInstaller() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            const btn = document.getElementById('installPwaBtn');
            if(btn) btn.classList.remove('hidden');
        });
    }

    async installPwa() {
        if (this.deferredPrompt) {
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                document.getElementById('installPwaBtn').classList.add('hidden');
            }
            this.deferredPrompt = null;
        }
    }

    searchMenu(value) {
        this.searchTerm = String(value || '').trim().toLocaleLowerCase('ar');
        this.renderMenu();
    }

    filterCategory(cat) {
        this.currentCategory = cat;
        document.querySelectorAll('.category-btn').forEach(b => {
            b.className = "category-btn px-4 py-2 rounded-2xl text-xs font-bold bg-white dark:bg-[#171513] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/5 transition whitespace-nowrap shadow-sm";
        });
        const activeBtn = document.getElementById(`cat-${cat}`);
        if(activeBtn) {
            activeBtn.className = "category-btn px-4 py-2 rounded-2xl text-xs font-bold bg-amber-600 text-white transition whitespace-nowrap shadow-sm";
        }
        this.renderMenu();
    }

    renderMenu() {
        const container = document.getElementById('menuList');
        if(!container) return;
        
        const filtered = this.menu.filter(item => {
            const matchesCategory = this.currentCategory === 'all' || item.category === this.currentCategory;
            const searchableText = `${item.name} ${item.desc}`.toLocaleLowerCase('ar');
            const matchesSearch = !this.searchTerm || searchableText.includes(this.searchTerm);
            return matchesCategory && matchesSearch;
        });

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="md:col-span-2 xl:col-span-3 text-center bg-white dark:bg-[#171513] border border-dashed border-slate-300 dark:border-white/10 rounded-3xl p-8 space-y-2">
                    <i class="fa-solid fa-mug-hot text-2xl text-amber-500"></i>
                    <p class="font-bold text-sm text-slate-700 dark:text-slate-200">ما لقينا هذا الاختيار</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">جرّب كلمة ثانية أو اختر قسمًا مختلفًا.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(item => `
            <article class="menu-card group relative flex min-h-[150px] flex-col justify-between overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-amber-400/60 hover:shadow-xl dark:border-white/5 dark:bg-[#171513] dark:hover:bg-[#1c1916]">
                <div class="absolute -left-8 -top-8 h-24 w-24 rounded-full bg-amber-500/5 transition-transform duration-500 group-hover:scale-150"></div>
                <div class="relative">
                    <div class="mb-3 flex items-start justify-between gap-3">
                        <span class="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-400">${item.category === 'hot' ? 'مشروب ساخن' : item.category === 'cold' ? 'مشروب بارد' : 'حلى'}</span>
                        <i class="fa-solid ${item.category === 'hot' ? 'fa-mug-hot' : item.category === 'cold' ? 'fa-glass-water' : 'fa-cake-candles'} text-lg text-amber-600/70 dark:text-amber-500/70" aria-hidden="true"></i>
                    </div>
                    <h4 class="text-sm font-black leading-6 text-slate-900 transition-colors group-hover:text-amber-700 dark:text-white dark:group-hover:text-amber-400 md:text-base">${item.name}</h4>
                    <p class="mt-1 min-h-10 text-xs leading-5 text-slate-500 dark:text-slate-400">${item.desc}</p>
                </div>
                <div class="relative mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-white/5">
                    <span class="text-sm font-black tabular-nums text-amber-700 dark:text-amber-400">${item.price} <span class="text-[10px] font-bold">ريال</span></span>
                    <button type="button" aria-label="إضافة ${item.name} إلى السلة" onclick="app.addToCart(${item.id})" class="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-amber-950/15 transition hover:bg-amber-500 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500">
                        <i class="fa-solid fa-plus text-[10px]" aria-hidden="true"></i> أضف للسلة
                    </button>
                </div>
            </article>
        `).join('');
    }

    addToCart(id) {
        const item = this.menu.find(i => i.id === id);
        if (!item) return;

        let existing = this.cart.find(i => i.id === id);
        if (existing) {
            existing.qty++;
        } else {
            this.cart.push({ ...item, qty: 1 });
        }
        this.updateCartUI();
    }

    changeQty(id, delta) {
        let item = this.cart.find(i => i.id === id);
        if (item) {
            item.qty += delta;
            if (item.qty <= 0) {
                this.removeFromCart(id);
            } else {
                this.updateCartUI();
            }
        }
    }

    removeFromCart(id) {
        this.cart = this.cart.filter(i => i.id !== id);
        this.updateCartUI();
    }

    updateCartUI() {
        // حفظ السلة حتى لا تضيع عند تحديث نسخة التطبيق.
        localStorage.setItem('cafe_cart', JSON.stringify(this.cart.map(({ id, qty }) => ({ id, qty }))));

        const cartBar = document.getElementById('cartBar');
        const totalSum = document.getElementById('cartTotalSum');
        const cartCountBadge = document.getElementById('cartCountBadge');
        
        const total = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const totalCount = this.cart.reduce((sum, item) => sum + item.qty, 0);

        if(totalSum) totalSum.textContent = total;
        if(cartCountBadge) cartCountBadge.textContent = totalCount;

        this.renderCartModalItems();

        if (this.cart.length > 0) {
            cartBar.classList.remove('hidden');
        } else {
            cartBar.classList.add('hidden');
            this.toggleCartModal(false);
        }
    }

    renderCartModalItems() {
        const container = document.getElementById('cartItemsList');
        const modalTotal = document.getElementById('cartModalTotal');
        if(!container) return;

        const total = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        if(modalTotal) modalTotal.textContent = total;

        container.innerHTML = this.cart.map(item => `
            <div class="bg-slate-100 dark:bg-black/30 border border-slate-200 dark:border-white/5 p-3 rounded-2xl flex justify-between items-center">
                <div class="flex-1">
                    <h5 class="font-bold text-xs text-slate-800 dark:text-white">${item.name}</h5>
                    <span class="text-[10px] text-slate-500 dark:text-slate-400">${item.price} ريال × ${item.qty}</span><span class="mt-1 block text-[11px] font-bold text-amber-600 dark:text-amber-400">الإجمالي: ${item.price * item.qty} ريال</span>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="app.changeQty(${item.id}, -1)" class="w-7 h-7 rounded-2xl bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-700 dark:text-white flex items-center justify-center text-xs"><i class="fa-solid fa-minus"></i></button>
                    <span class="text-xs font-bold text-slate-800 dark:text-white w-5 text-center">${item.qty}</span>
                    <button onclick="app.changeQty(${item.id}, 1)" class="w-7 h-7 rounded-2xl bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-700 dark:text-white flex items-center justify-center text-xs"><i class="fa-solid fa-plus"></i></button>
                    <button onclick="app.removeFromCart(${item.id})" class="w-7 h-7 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 dark:text-rose-400 flex items-center justify-center text-xs ml-1"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `).join('');
    }

    toggleCartModal(show) {
        const modal = document.getElementById('cartModal');
        if(show) {
            this.renderCartModalItems();
            modal.classList.remove('hidden');
        } else {
            modal.classList.add('hidden');
        }
    }

    setupOrderDetails() {
        const orderType = document.getElementById('orderType');
        if (!orderType) return;

        const updateFields = () => {
            const isDineIn = orderType.value === 'dine-in';
            const isDelivery = orderType.value === 'delivery';
            document.getElementById('tableNumberField')?.classList.toggle('hidden', !isDineIn);
            document.getElementById('deliveryAddressField')?.classList.toggle('hidden', !isDelivery);
        };

        orderType.addEventListener('change', updateFields);
        updateFields();
    }

    sendToWhatsApp() {
        if (this.cart.length === 0) {
            this.showAlert('السلة فارغة', 'أضف المنتجات التي ترغب بها أولاً، وبعدها أرسل طلبك.', 'info');
            return;
        }

        const customerName = document.getElementById('customerName')?.value.trim() || '';
        const orderType = document.getElementById('orderType')?.value || 'dine-in';
        const tableNumber = document.getElementById('tableNumber')?.value.trim() || '';
        const deliveryAddress = document.getElementById('deliveryAddress')?.value.trim() || '';
        const orderNotes = document.getElementById('orderNotes')?.value.trim() || '';

        if (!customerName) {
            this.showAlert('نحتاج اسمك أولاً', 'اكتب اسم صاحب الطلب حتى يعرف فريق الكافي لمن يجهز الطلب.', 'info');
            document.getElementById('customerName')?.focus();
            return;
        }

        if (orderType === 'delivery' && !deliveryAddress) {
            this.showAlert('عنوان التوصيل مطلوب', 'اكتب المنطقة والعنوان وأقرب معلم حتى نعرف مكان التوصيل.', 'info');
            document.getElementById('deliveryAddress')?.focus();
            return;
        }

        if (orderType === 'dine-in' && tableNumber && (!Number.isInteger(Number(tableNumber)) || Number(tableNumber) < 1 || Number(tableNumber) > 99)) {
            this.showAlert('رقم الطاولة غير صحيح', 'أدخل رقم طاولة صحيحًا من 1 إلى 99، أو اترك الحقل فارغًا.', 'info');
            document.getElementById('tableNumber')?.focus();
            return;
        }

        const orderTypeLabels = { 'dine-in': 'داخل الكافي', 'takeaway': 'سفري / استلام', 'delivery': 'توصيل' };
        const phone = '967776425406';
        const itemsText = this.cart.map(item =>
            `▪️ ${item.name} (×${item.qty}) - ${item.price * item.qty} ريال`
        ).join('\n');
        const total = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const details = [
            `👤 اسم العميل: ${customerName}`,
            `📦 نوع الطلب: ${orderTypeLabels[orderType] || orderTypeLabels['dine-in']}`,
            orderType === 'dine-in' && tableNumber ? `🪑 رقم الطاولة: ${tableNumber}` : '',
            orderType === 'delivery' ? `📍 عنوان التوصيل: ${deliveryAddress}` : '',
            orderNotes ? `📝 ملاحظات: ${orderNotes}` : ''
        ].filter(Boolean).join('\n');

        const message = `✨ *طلب جديد من الجود كافيه*\n------------------\n${details}\n------------------\n*تفاصيل الطلب:*\n${itemsText}\n------------------\n*المجموع الكلي: ${total} ريال*`;
        const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
        this.toggleCartModal(false);
    }

    toggleLoyalty(show) {
        const modal = document.getElementById('loyaltyModal');
        if (show) {
            modal.classList.remove('hidden');
            this.renderStampsGrid();
        } else {
            modal.classList.add('hidden');
        }
    }

    renderStampsGrid() {
        const grid = document.getElementById('stampsGrid');
        if(!grid) return;
        let html = '';
        const logoSrc = "logo.png";

        for (let i = 1; i <= 6; i++) {
            const isStamped = i <= this.stamps;
            if (isStamped) {
                html += `
                    <div class="h-20 rounded-2xl border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/40 flex flex-col items-center justify-center relative overflow-hidden shadow-lg animate-in">
                        <img src="${logoSrc}" class="w-9 h-9 rounded-full object-cover border border-amber-400/50" onerror="this.src='https://via.placeholder.com/150'">
                        <span class="text-[9px] font-bold text-amber-700 dark:text-amber-300 mt-1">ختم ${i}</span>
                        <div class="absolute top-1 right-1 bg-amber-500 text-black rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold"><i class="fa-solid fa-check"></i></div>
                    </div>
                `;
            } else {
                html += `
                    <div class="h-20 rounded-2xl border-2 border-dashed border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-black/20 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600">
                        <i class="fa-solid fa-mug-hot text-base opacity-30"></i>
                        <span class="text-[9px] mt-1 text-slate-400 dark:text-slate-500">ختم ${i}</span>
                    </div>
                `;
            }
        }
        grid.innerHTML = html;
        this.updateLoyaltyUI();
    }

    updateLoyaltyUI() {
        const stampsCountEl = document.getElementById('stampsCount');
        if(stampsCountEl) stampsCountEl.textContent = this.stamps;
    }

    setTodayQRBadge() {
        const today = new Date().toISOString().slice(0, 10);
        const badge = document.getElementById('qrDateBadge');
        if(badge) badge.textContent = today;
    }

    verifyAndAddStamp() {
        const pinInput = document.getElementById('cashierPinInput').value;
        if (pinInput === '7788') {
            if (this.stamps < 6) {
                this.stamps++;
                localStorage.setItem('cafe_stamps', this.stamps);
                this.renderStampsGrid();
                document.getElementById('cashierPinInput').value = '';
                
                if (this.stamps === 6) {
                    this.showAlert('كفو والله! الف مبروك 🎉', 'أكملت 6 أختام واستحقت مشروبك السابع المجاني منا عساه بالعافية.', 'success');
                } else {
                    this.showAlert('تم الختم يالغالي ✅', `حطينا لك الختم رقم (${this.stamps})، باقي شوي وتوصل للجائزة!`, 'success');
                }
            } else {
                this.showAlert('يا طويل العمر', 'أنت مقفل الاختام كلها ومستحق جائزتك مسبقاً!', 'info');
            }
        } else {
            this.showAlert('خطأ بالرمز ❌', 'رمز الكاشير غير صحيح، تأكد منه زين.', 'error');
        }
    }

    openContactModal() {
        document.getElementById('contactModal').classList.remove('hidden');
    }

    closeContactModal() {
        document.getElementById('contactModal').classList.add('hidden');
    }

    openMoodModal() {
        const list = document.getElementById('moodOptionsList');
        if(!list) return;
        const moods = [
            { text: '🔥 رايق وأبي كيف ثقيل يضبط الراس', itemIndex: 0 },
            { text: '😌 مروق وأبي شي بارد يبرد على القلب', itemIndex: 3 },
            { text: '🍰 تعبان وأبي حلا يعدل المزاج', itemIndex: 6 }
        ];

        list.innerHTML = moods.map(m => `
            <button onclick="app.selectMood(${m.itemIndex})" class="w-full text-right p-3.5 rounded-2xl bg-slate-100 dark:bg-white/5 hover:bg-amber-100 dark:hover:bg-amber-500/10 text-xs font-bold border border-slate-200 dark:border-white/5 text-slate-700 dark:text-slate-200 transition flex items-center justify-between group">
                <span>${m.text}</span>
                <i class="fa-solid fa-chevron-left text-slate-400 dark:text-slate-600 group-hover:text-amber-600 dark:group-hover:text-amber-500 text-[10px] transition-colors"></i>
            </button>
        `).join('');
        document.getElementById('moodModal').classList.remove('hidden');
    }

    closeMoodModal() {
        document.getElementById('moodModal').classList.add('hidden');
    }

    selectMood(index) {
        const recommended = this.menu.find(i => i.id === index + 1) || this.menu[0];
        this.closeMoodModal();
        this.showAlert('اختيار الذكاء الاصطناعي ☕', `على خشمي، نرشح لك: (${recommended.name}) بسعر ${recommended.price} ريال، وضفناه لك بالسلة.`, 'success');
        this.addToCart(recommended.id);
    }

    showAlert(title, message, type) {
        const modal = document.getElementById('customAlertModal');
        document.getElementById('alertTitle').textContent = title;
        document.getElementById('alertMessage').textContent = message;
        const iconContainer = document.getElementById('alertIconContainer');
        const btnEl = document.getElementById('alertButton');

        if (type === 'success') {
            iconContainer.className = "w-16 h-16 mx-auto rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-2xl border border-emerald-500/20";
            iconContainer.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
            btnEl.className = "w-full py-3 rounded-2xl text-xs font-bold text-white shadow-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition";
        } else if (type === 'error') {
            iconContainer.className = "w-16 h-16 mx-auto rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center text-2xl border border-rose-500/20";
            iconContainer.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
            btnEl.className = "w-full py-3 rounded-2xl text-xs font-bold text-white shadow-lg bg-rose-600 hover:bg-rose-500 active:scale-95 transition";
        } else {
            iconContainer.className = "w-16 h-16 mx-auto rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-2xl border border-amber-500/20";
            iconContainer.innerHTML = '<i class="fa-solid fa-circle-info"></i>';
            btnEl.className = "w-full py-3 rounded-2xl text-xs font-bold text-white shadow-lg bg-amber-600 hover:bg-amber-500 active:scale-95 transition";
        }
        modal.classList.remove('hidden');
    }

    closeAlert() {
        document.getElementById('customAlertModal').classList.add('hidden');
    }
}

const app = new CafeApp();
