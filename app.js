class CafeApp {
    constructor() {
        this.stamps = parseInt(localStorage.getItem('cafe_stamps') || '0');
        this.cart = [];
        this.menu = [
            { id: 1, name: 'إسبريسو مكياتو', desc: 'قهوة مركزة برغوة حليب ناعمة', price: 1500 },
            { id: 2, name: 'آيس برود لاتيه', desc: 'مشروب البارود المنعش الخاص بالكافي', price: 3000 },
            { id: 3, name: 'تشيز كيك التوت', desc: 'طازج ولذيذ يروق الراس', price: 2500 },
            { id: 4, name: 'شاي كرك خاص', desc: 'بالبهارات الهندية الأصيلة', price: 1000 }
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
            <div class="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center transition hover:shadow-md">
                <div class="flex-1 pl-3">
                    <h4 class="font-bold text-xs text-slate-800">${item.name}</h4>
                    <p class="text-[11px] text-slate-400 mb-1.5">${item.desc}</p>
                    <span class="text-amber-900 font-extrabold text-xs">${item.price} ريال</span>
                </div>
                <button onclick="app.addToCart(${item.id})" class="bg-amber-900 text-white w-9 h-9 rounded-xl flex items-center justify-center shadow-md shadow-amber-900/20 active:scale-95 transition">
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
        const phone = "967700000000"; // استبدله برقم الكافي الحقيقي
        let text = "✨ *طلب جديد من كافيه البرود*%0A------------------%0A";
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
        const logoSrc = "Screenshot_٢٠٢٦١١١٧-٠٠٤٣٣١_Instagram-removebg-preview.png";

        for (let i = 1; i <= 6; i++) {
            const isStamped = i <= this.stamps;
            if (isStamped) {
                // ختم بداخلها الشعار المرفق متعبئ
                html += `
                    <div class="h-20 rounded-2xl border-2 border-amber-900 bg-amber-50 flex flex-col items-center justify-center relative overflow-hidden shadow-sm animate-in">
                        <img src="${logoSrc}" class="w-10 h-10 rounded-full object-cover border border-amber-900/30 opacity-90">
                        <span class="text-[9px] font-bold text-amber-900 mt-1">ختمة ${i}</span>
                        <div class="absolute top-1 right-1 bg-amber-900 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px]"><i class="fa-solid fa-check"></i></div>
                    </div>
                `;
            } else {
                html += `
                    <div class="h-20 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-300">
                        <i class="fa-solid fa-mug-hot text-base opacity-40"></i>
                        <span class="text-[9px] mt-1 text-slate-400">ختمة ${i}</span>
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
        // رمز الكاشير الافتراضي للأمان (يمكن تغييره)
        if (pinInput === '7788') {
            if (this.stamps < 6) {
                this.stamps++;
                localStorage.setItem('cafe_stamps', this.stamps);
                this.renderStampsGrid();
                document.getElementById('cashierPinInput').value = '';
                
                if (this.stamps === 6) {
                    this.showAlert('مبروك الفوز! 🎉', 'أكملت 6 ختمات بنجاح! استحقيت الآن مشروبك السابع المجاني من كافيه البرود.', 'success');
                } else {
                    this.showAlert('تم تسجيل الختمة بنجاح ✅', `تمت إضافة الختمة رقم (${this.stamps}) إلى كرت الولاء الخاص بك.`, 'success');
                }
            } else {
                this.showAlert('تنبيه هام ℹ️', 'لقد أكملت جميع الختمات السابقة واستحقت الجائزة بالفعل!', 'info');
            }
        } else {
            this.showAlert('خطأ في التحقق ❌', 'رمز الكاشير السري غير صحيح. يرجى مراجعة الباريستا.', 'error');
        }
    }

    openMoodModal() {
        const list = document.getElementById('moodOptionsList');
        const moods = [
            { text: '🔥 رايق ونشيط (أحتاج قهوة ثقيلة تقفل المزاج)', itemIndex: 0 },
            { text: '😌 منعش وفوق السحاب (مشروب بارد يروق الدم)', itemIndex: 1 },
            { text: '🍰 تعبان وأحتاج حلا يعدل اليوم', itemIndex: 2 }
        ];

        list.innerHTML = moods.map(m => `
            <button onclick="app.selectMood(${m.itemIndex})" class="w-full text-right p-3 rounded-2xl bg-slate-50 hover:bg-amber-50 text-xs font-bold border border-slate-100 transition flex items-center justify-between">
                <span>${m.text}</span>
                <i class="fa-solid fa-chevron-left text-slate-300 text-[10px]"></i>
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
        this.showAlert('اختيار الذكاء الاصطناعي ☕', `بناءً على مزاجك، نرشح لك بقوة: (${recommended.name}) بسعر ${recommended.price} ريال. تم إضافته لسلتك!`, 'success');
        this.addToCart(recommended.id);
    }

    showAlert(title, message, type) {
        const modal = document.getElementById('customAlertModal');
        const titleEl = document.getElementById('alertTitle');
        const msgEl = document.getElementById('alertMessage');
        const iconContainer = document.getElementById('alertIconContainer');
        const btnEl = document.getElementById('alertButton');

        titleEl.textContent = title;
        msgEl.textContent = message;

        if (type === 'success') {
            iconContainer.className = "w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl shadow-inner";
            iconContainer.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
            btnEl.className = "w-full py-3 rounded-2xl text-xs font-bold text-white shadow-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition";
        } else if (type === 'error') {
            iconContainer.className = "w-16 h-16 mx-auto rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-2xl shadow-inner";
            iconContainer.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
            btnEl.className = "w-full py-3 rounded-2xl text-xs font-bold text-white shadow-lg bg-rose-600 hover:bg-rose-700 active:scale-95 transition";
        } else {
            iconContainer.className = "w-16 h-16 mx-auto rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-2xl shadow-inner";
            iconContainer.innerHTML = '<i class="fa-solid fa-circle-info"></i>';
            btnEl.className = "w-full py-3 rounded-2xl text-xs font-bold text-white shadow-lg bg-amber-900 hover:bg-amber-800 active:scale-95 transition";
        }

        modal.classList.remove('hidden');
    }

    closeAlert() {
        document.getElementById('customAlertModal').classList.add('hidden');
    }
}

// تشغيل التطبيق عند تحميل الصفحة
const app = new CafeApp();
