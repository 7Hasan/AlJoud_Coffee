class CafeApp {
    constructor() {
        this.stamps = parseInt(localStorage.getItem('cafe_stamps') || '0');
        this.cart = [];
        this.menu = [
            { id: 1, name: 'إسبريسو مكياتو فاخر', desc: 'قهوة مركزة برغوة حليب ناعمة', price: 1500 },
            { id: 2, name: 'آيس برود لاتيه', desc: 'مشروب البارود المنعش الخاص بالكافي', price: 3000 },
            { id: 3, name: 'تشيز كيك التوت البلدي', desc: 'طازج ولذيذ يعدل المزاج تماماً', price: 2500 },
            { id: 4, name: 'شاي كرك عدني أصلي', desc: 'بالبهارات الخاصة والهيل الهندي', price: 1000 }
        ];
        this.init();
    }

    init() {
        this.renderMenu();
        this.updateLoyaltyUI();
        this.setTodayQRBadge();
    }

    renderMenu() {
        const container = document.getElementById('menuList');
        container.innerHTML = this.menu.map(item => `
            <div class="bg-[#171513] border border-white/5 p-4 rounded-3xl flex justify-between items-center transition-all duration-300 hover:border-amber-500/30 hover:bg-[#1c1916] group">
                <div class="flex-1 pl-3">
                    <h4 class="font-bold text-xs text-white group-hover:text-amber-400 transition-colors">${item.name}</h4>
                    <p class="text-[11px] text-slate-400 mb-2">${item.desc}</p>
                    <span class="text-amber-400 font-black text-xs">${item.price} ريال</span>
                </div>
                <button onclick="app.addToCart(${item.id})" class="bg-amber-600 text-white w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-900/40 active:scale-90 transition-all duration-300 hover:bg-amber-500">
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

    updateCartUI() {
        const cartBar = document.getElementById('cartBar');
        const totalSum = document.getElementById('cartTotalSum');
        const total = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

        totalSum.textContent = total;
        if (this.cart.length > 0) {
            cartBar.classList.remove('hidden');
        } else {
            cartBar.classList.add('hidden');
        }
    }

    sendToWhatsApp() {
        const phone = "967776425406";
        let text = "✨ *طلب جديد من كافيه الجُود*%0A------------------%0A";
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
        let html = '';
        const logoSrc = "logo.png";

        for (let i = 1; i <= 6; i++) {
            const isStamped = i <= this.stamps;
            if (isStamped) {
                html += `
                    <div class="h-20 rounded-2xl border-2 border-amber-500 bg-amber-950/40 flex flex-col items-center justify-center relative overflow-hidden shadow-lg animate-in">
                        <img src="${logoSrc}" class="w-9 h-9 rounded-full object-cover border border-amber-400/50">
                        <span class="text-[9px] font-bold text-amber-300 mt-1">ختمة ${i}</span>
                        <div class="absolute top-1 right-1 bg-amber-500 text-black rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold"><i class="fa-solid fa-check"></i></div>
                    </div>
                `;
            } else {
                html += `
                    <div class="h-20 rounded-2xl border-2 border-dashed border-white/10 bg-black/20 flex flex-col items-center justify-center text-slate-600">
                        <i class="fa-solid fa-mug-hot text-base opacity-30"></i>
                        <span class="text-[9px] mt-1 text-slate-500">ختمة ${i}</span>
                    </div>
                `;
            }
        }
        grid.innerHTML = html;
        document.getElementById('stampsCount').textContent = this.stamps;
    }

    setTodayQRBadge() {
        const today = new Date().toISOString().slice(0, 10);
        document.getElementById('qrDateBadge').textContent = today;
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
                    this.showAlert('مبروك الفوز! 🎉', 'أكملت 6 ختمات بنجاح واستحقيت مشروبك السابع المجاني.', 'success');
                } else {
                    this.showAlert('تمت إضافة الختمة ✅', `تم تسجيل الختمة رقم (${this.stamps}) بنجاح.`, 'success');
                }
            } else {
                this.showAlert('تنبيه', 'أكملت جميع الختمات مسبقاً!', 'info');
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
        const moods = [
            { text: '🔥 رايق ونشيط (أحتاج قهوة ثقيلة تقفل المزاج)', itemIndex: 0 },
            { text: '😌 منعش وفوق السحاب (مشروب بارد يروق الدم)', itemIndex: 1 },
            { text: '🍰 تعبان وأحتاج حلا يعدل اليوم', itemIndex: 2 }
        ];

        list.innerHTML = moods.map(m => `
            <button onclick="app.selectMood(${m.itemIndex})" class="w-full text-right p-3.5 rounded-2xl bg-white/5 hover:bg-amber-500/10 text-xs font-bold border border-white/5 text-slate-200 transition flex items-center justify-between group">
                <span>${m.text}</span>
                <i class="fa-solid fa-chevron-left text-slate-600 group-hover:text-amber-500 text-[10px] transition-colors"></i>
            </button>
        `).join('');
        document.getElementById('moodModal').classList.remove('hidden');
    }

    closeMoodModal() {
        document.getElementById('moodModal').classList.add('hidden');
    }

    selectMood(index) {
        const recommended = this.menu[index];
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
            iconContainer.className = "w-16 h-16 mx-auto rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-2xl border border-emerald-500/20";
            iconContainer.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
            btnEl.className = "w-full py-3 rounded-2xl text-xs font-bold text-white shadow-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition";
        } else if (type === 'error') {
            iconContainer.className = "w-16 h-16 mx-auto rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center text-2xl border border-rose-500/20";
            iconContainer.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
            btnEl.className = "w-full py-3 rounded-2xl text-xs font-bold text-white shadow-lg bg-rose-600 hover:bg-rose-500 active:scale-95 transition";
        } else {
            iconContainer.className = "w-16 h-16 mx-auto rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center text-2xl border border-amber-500/20";
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
