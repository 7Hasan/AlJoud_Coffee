class CafeApp {
    constructor() {
        this.stamps = parseInt(localStorage.getItem('cafe_stamps') || '0');
        this.cart = [];
        this.currentCategory = 'all';
        this.menu = [
            { id: 1, name: 'إسبريسو مكياتو فاخر', desc: 'قهوة مركزة برغوة حليب ناعمة', price: 1500, category: 'hot' },
            { id: 2, name: 'شاي كرك عدني أصلي', desc: 'بالبهارات الخاصة والهيل الهندي', price: 1000, category: 'hot' },
            { id: 3, name: 'قهوة تركي على الصاج', desc: 'مضبوطة على الوجه بطعم أصيل', price: 1200, category: 'hot' },
            { id: 4, name: 'آيس الجود لاتيه', desc: 'مشروب الكافي البارد والمميز الخاص بنا', price: 3000, category: 'cold' },
            { id: 5, name: 'موهيتو نكهات منعش', desc: 'بالنعناع الطازج والليمون الصافي', price: 2000, category: 'cold' },
            { id: 6, name: 'آيس سبانيش لاتيه', desc: 'حليب بارد مع الإسبريسو والحليب المكثف', price: 3200, category: 'cold' },
            { id: 7, name: 'تشيز كيك التوت البلدي', desc: 'طازج ولذيذ يعدل المزاج تماماً', price: 2500, category: 'dessert' },
            { id: 8, name: 'كيكة الشوكولاتة البلجيكية', desc: 'غنية بالصوص الدافئ المقرمش', price: 3500, category: 'dessert' }
        ];
        this.deferredPrompt = null;
        this.init();
    }

    init() {
        this.initTheme();
        this.renderMenu();
        this.updateLoyaltyUI();
        this.setTodayQRBadge();
        this.setupPWAInstaller();
        this.registerServiceWorker();
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(() => console.log('Service Worker Registered'))
                .catch(err => console.log('SW registration failed: ', err));
        }
    }

    initTheme() {
        const savedTheme = localStorage.getItem('cafe_theme') || 'dark';
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
        
        const filtered = this.currentCategory === 'all' 
            ? this.menu 
            : this.menu.filter(i => i.category === this.currentCategory);

        container.innerHTML = filtered.map(item => `
            <div class="bg-white dark:bg-[#171513] border border-slate-200 dark:border-white/5 p-4 rounded-3xl flex justify-between items-center transition-all duration-300 hover:border-amber-500/30 hover:bg-slate-50 dark:hover:bg-[#1c1916] shadow-sm group">
                <div class="flex-1 pl-3">
                    <h4 class="font-bold text-xs md:text-sm text-slate-800 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">${item.name}</h4>
                    <p class="text-[11px] text-slate-500 dark:text-slate-400 mb-2">${item.desc}</p>
                    <span class="text-amber-600 dark:text-amber-400 font-black text-xs">${item.price} ريال</span>
                </div>
                <button onclick="app.addToCart(${item.id})" class="bg-amber-600 text-white w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-950/40 active:scale-90 transition-all hover:bg-amber-500">
                    <i class="fa-solid fa-plus text-xs"></i>
                </button>
            </div>
        `).join('');
    }

    addToCart(id) {
        const item = this.menu.find(i => i.id === id);
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
                    <span class="text-[10px] text-amber-600 dark:text-amber-400">${item.price * item.qty} ريال</span>
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
        const phone = "967700000000";
        let text = "✨ *طلب جديد من الجود كافيه*%0A------------------%0A";
        this.cart.forEach(item => {
            text += `▪️ ${item.name} (x${item.qty}) - ${item.price * item.qty} ريال%0A`;
        });
        text += `------------------%0A*المجموع الكلي: ${this.cart.reduce((s, i) => s + (i.price * i.qty), 0)} ريال*`;
        
        window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
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
                    this.showAlert('مبروك الفوز! 🎉', 'أكملت 6 أختام بنجاح واستحقيت مشروبك السابع المجاني من الجود كافيه.', 'success');
                } else {
                    this.showAlert('تمت إضافة الختم ✅', `تم تسجيل الختم رقم (${this.stamps}) بنجاح.`, 'success');
                }
            } else {
                this.showAlert('تنبيه', 'أكملت جميع الأختام مسبقاً!', 'info');
            }
        } else {
            this.showAlert('خطأ ❌', 'رمز الكاشير غير صحيح.', 'error');
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
            { text: '🔥 رايق ونشيط (أحتاج قهوة ثقيلة تقفل المزاج)', itemIndex: 0 },
            { text: '😌 منعش وفوق السحاب (مشروب بارد يروق الدم)', itemIndex: 3 },
            { text: '🍰 تعبان وأحتاج حلا يعدل اليوم', itemIndex: 6 }
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
        this.showAlert('اختيار الذكاء الاصطناعي ☕', `بناءً على مزاجك، نرشح لك: (${recommended.name}) بسعر ${recommended.price} ريال. تم إضافته لسلتك!`, 'success');
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
