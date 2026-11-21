const API = 'https://aljoud-push-api.ese37522.workers.dev';
const $ = (s) => document.querySelector(s);
const tokenKey = 'aljoud_admin_session';
const token = () => sessionStorage.getItem(tokenKey);
const api = async (path, options={}) => {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type','application/json');
  if (token()) headers.set('Authorization','Bearer '+token());
  const response = await fetch(API+path,{...options,headers});
  const data = await response.json().catch(()=>({error:'استجابة غير مفهومة من الخادم'}));
  if (!response.ok) throw new Error(data.error || data.message || 'تعذر تنفيذ الطلب');
  return data;
};
const message = (el,text,type='') => {el.textContent=text;el.className='message '+type;};
const showDashboard = (user) => {
  $('#loginView').classList.add('hidden');$('#dashboardView').classList.remove('hidden');$('#logoutBtn').classList.remove('hidden');
  $('#userName').textContent=user.name || user.username;$('#rolePill').textContent=user.role==='admin'?'مدير':'موظف';
  $('#usersPanel').classList.toggle('hidden',user.role!=='admin');$('#connection').textContent='متصل';$('#connection').style.color='var(--green)';
  loadDashboard(user.role);
  restoreCampaign();
};
const loadDashboard = async (role) => {
  try{
    const data=await api('/admin/stats');
    $('#subCount').textContent=data.subscribers ?? '—';$('#sentCount').textContent=data.sent ?? '—';$('#failedCount').textContent=data.failed ?? '—';
    const list=$('#historyList');list.innerHTML='';
    (data.history||[]).slice(0,8).forEach(item=>{const row=document.createElement('div');row.className='history-item';const info=document.createElement('div');const title=document.createElement('b');title.textContent=item.title||'إشعار';const meta=document.createElement('small');meta.textContent=new Date(item.created_at).toLocaleString('ar');info.append(title,meta);const status=document.createElement('span');status.className='result'+(item.failed?' bad':'');status.textContent='نجح '+(item.sent||0)+' · فشل '+(item.failed||0);row.append(info,status);list.append(row);});
    if(!list.children.length) list.innerHTML='<p class="muted">لا توجد عمليات إرسال مسجلة بعد.</p>';
    if(role==='admin') await loadUsers();
  }catch(error){$('#connection').textContent='تعذر الاتصال';message($('#sendMessage'),'تعذر تحميل البيانات: '+error.message,'error');}
};
const loadUsers=async()=>{
  try{const data=await api('/admin/users');const root=$('#usersList');root.innerHTML='';
    (data.users||[]).forEach(user=>{const row=document.createElement('div');row.className='user-item';const info=document.createElement('div');const name=document.createElement('b');name.textContent=user.name+' · '+user.username;const meta=document.createElement('small');meta.textContent=(user.email||'بدون بريد')+' · '+(user.active?'نشط':'معطّل');info.append(name,meta);row.append(info);if(user.role!=='admin'&&user.active){const btn=document.createElement('button');btn.textContent='تعطيل الحساب';btn.onclick=async()=>{if(!confirm('تعطيل حساب '+user.username+'؟'))return;try{await api('/admin/users/'+encodeURIComponent(user.id),{method:'PATCH',body:JSON.stringify({active:false})});await loadUsers();}catch(e){message($('#usersMessage'),e.message,'error');}};row.append(btn);}root.append(row);});
    if(!root.children.length)root.innerHTML='<p class="muted">لا توجد حسابات موظفين.</p>';
  }catch(e){$('#usersList').textContent='تعذر تحميل الحسابات: '+e.message;}
};
$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const btn=e.currentTarget.querySelector('button');btn.disabled=true;try{const data=await api('/auth/login',{method:'POST',body:JSON.stringify({username:f.get('username'),password:f.get('password')})});sessionStorage.setItem(tokenKey,data.token);showDashboard(data.user);}catch(err){message($('#authMessage'),err.message,'error');}finally{btn.disabled=false;}});
$('#bootstrapForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const btn=e.currentTarget.querySelector('button');btn.disabled=true;try{const data=await api('/auth/bootstrap',{method:'POST',body:JSON.stringify({name:f.get('name'),username:f.get('username'),email:f.get('email'),password:f.get('password'),bootstrapKey:f.get('bootstrapKey')})});sessionStorage.setItem(tokenKey,data.token);showDashboard(data.user);}catch(err){message($('#authMessage'),err.message,'error');}finally{btn.disabled=false;}});
$('#showBootstrap').onclick=()=>{$('#loginFormWrap').classList.add('hidden');$('#bootstrapWrap').classList.remove('hidden');};
$('#showLogin').onclick=()=>{$('#bootstrapWrap').classList.add('hidden');$('#loginFormWrap').classList.remove('hidden');};
$('#logoutBtn').onclick=async()=>{try{await api('/auth/logout',{method:'POST',body:'{}'});}catch{}sessionStorage.removeItem(tokenKey);location.reload();};

let campaignPoll=null;
const renderCampaign=campaign=>{
 const root=$('#campaignProgress');if(!root)return;
 root.classList.remove('hidden');
 const done=['completed','completed_with_failures'].includes(campaign.state);
 const pct=campaign.total?Math.min(100,Math.round((campaign.processed/campaign.total)*100)):100;
 $('#campaignTitle').textContent=campaign.title;
 $('#campaignState').textContent=campaign.state==='queued'?'بانتظار الدفعة التالية':campaign.state==='running'?'جارٍ الإرسال بالخلفية':campaign.state==='completed'?'اكتملت الحملة':campaign.state==='completed_with_failures'?'اكتملت مع إخفاقات':'—';
 $('#campaignNumbers').textContent='تمت معالجة '+campaign.processed+' من '+campaign.total+' · نجح '+campaign.sent+' · فشل '+campaign.failed+' · منتهٍ '+campaign.expired;
 $('#campaignBar').style.width=pct+'%';
 if(done){if(campaignPoll){clearInterval(campaignPoll);campaignPoll=null;}message($('#sendMessage'),campaign.state==='completed'?'اكتملت الحملة بنجاح.':'اكتملت الحملة، راجع عدد الإخفاقات والاشتراكات المنتهية.','success');}
};
const restoreCampaign=async()=>{
 try{const data=await api('/admin/campaigns/latest');if(!data.campaign)return;renderCampaign(data.campaign);if(['queued','running'].includes(data.campaign.state))watchCampaign(data.campaign.id);}catch(e){console.warn('Could not restore campaign status:',e);}
};
const watchCampaign=id=>{
 if(campaignPoll)clearInterval(campaignPoll);
 const poll=async()=>{try{const data=await api('/admin/campaigns/'+encodeURIComponent(id));renderCampaign(data.campaign);if(['completed','completed_with_failures'].includes(data.campaign.state))await loadDashboard($('#rolePill').textContent==='مدير'?'admin':'employee');}catch(e){message($('#sendMessage'),'تعذر تحديث حالة الحملة: '+e.message,'error');}};
 poll();campaignPoll=setInterval(poll,15000);
};
$('#sendForm').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;const f=new FormData(form);const btn=e.currentTarget.querySelector('button[type=submit]');if(!confirm('تأكيد إرسال هذا الإشعار إلى جميع المشتركين؟'))return;btn.disabled=true;try{const data=await api('/admin/campaigns',{method:'POST',body:JSON.stringify({title:f.get('title'),body:f.get('body'),url:f.get('url')||'/AlJoud_Coffee/'})});renderCampaign(data.campaign);watchCampaign(data.campaign.id);message($('#sendMessage'),'تم تأكيد الحملة وبدأت المعالجة بالخلفية. يمكنك إغلاق الصفحة.','success');form.reset();$('#titleCount').textContent='0';$('#bodyCount').textContent='0';await loadDashboard($('#rolePill').textContent==='مدير'?'admin':'employee');}catch(err){message($('#sendMessage'),err.message,'error');}finally{btn.disabled=false;}});

$('#userForm').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;const f=new FormData(form);const btn=e.currentTarget.querySelector('button');btn.disabled=true;try{const data=await api('/admin/users',{method:'POST',body:JSON.stringify({name:f.get('name'),username:f.get('username'),email:f.get('email'),password:f.get('password'),role:'employee'})});message($('#usersMessage'),'تم إنشاء حساب الموظف: '+data.user.username,'success');form.reset();await loadUsers();}catch(err){message($('#usersMessage'),err.message,'error');}finally{btn.disabled=false;}});
$('#refreshBtn').onclick=()=>loadDashboard($('#rolePill').textContent==='مدير'?'admin':'employee');
for(const [field,count] of [['input[name=title]','#titleCount'],['textarea[name=body]','#bodyCount']])$(field).addEventListener('input',e=>$(count).textContent=e.target.value.length);
(async()=>{if(!token())return;try{const data=await api('/auth/me');showDashboard(data.user);}catch{sessionStorage.removeItem(tokenKey);$('#connection').textContent='انتهت الجلسة';}})();