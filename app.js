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

    registerServiceWorker() {
        if (!('serviceWorker' in navigator)) return;

        // لا نعيد تحميل الصفحة عند أول تثبيت؛ نحدّثها فقط عند وصول نسخة جديدة.
        let hasControlledPage = Boolean(navigator.serviceWorker.controller);

        navigator.serviceWorker.register('./sw.js')
            .then((registration) => {
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

    sendToWhatsApp() {
        if (this.cart.length === 0) {
            this.showAlert('السلة فارغة', 'أضف المنتجات التي ترغب بها أولاً، وبعدها أرسل طلبك.', 'info');
            return;
        }

        const phone = "967776425406";
        const itemsText = this.cart.map(item =>
            `▪️ ${item.name} (x${item.qty}) - ${item.price * item.qty} ريال`
        ).join('\n');
        const total = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const message = `✨ *يا هلا، عندي طلب جديد من الجود كافيه*\n------------------\n${itemsText}\n------------------\n*المجموع الكلي: ${total} ريال*`;
        const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
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
