const STORAGE_KEY = 'agenda_psi_consultas_v3';
const PROFILE_KEY = 'agenda_psi_perfil_v3';
let appointments = loadAppointments();
let profile = loadProfile();
let selectedDate = toDateInput(new Date());
let currentMonth = new Date();
let currentWeek = startOfWeek(new Date());
let deferredPrompt = null;

const $ = (id) => document.getElementById(id);
const screens = document.querySelectorAll('.screen');
const navBtns = document.querySelectorAll('.nav-btn');

init();

function init(){
  applyTheme();
  setupEvents();
  fillProfileInputs();
  renderAll();
  registerSW();
}

function setupEvents(){
  navBtns.forEach(btn=>btn.addEventListener('click',()=>showScreen(btn.dataset.screen)));
  $('newAppointmentBtn').addEventListener('click',()=>openModal());
  $('newOnSelectedDate').addEventListener('click',()=>openModal({date:selectedDate}));
  $('closeModal').addEventListener('click',closeModal);
  $('modal').addEventListener('click',(e)=>{ if(e.target.id==='modal') closeModal(); });
  $('appointmentForm').addEventListener('submit',saveAppointment);
  $('prevMonth').addEventListener('click',()=>{currentMonth.setMonth(currentMonth.getMonth()-1);renderMonth();});
  $('nextMonth').addEventListener('click',()=>{currentMonth.setMonth(currentMonth.getMonth()+1);renderMonth();});
  $('prevWeek').addEventListener('click',()=>{currentWeek.setDate(currentWeek.getDate()-7);renderWeek();});
  $('nextWeek').addEventListener('click',()=>{currentWeek.setDate(currentWeek.getDate()+7);renderWeek();});
  $('searchInput').addEventListener('input',renderSearch);
  $('printTodayBtn').addEventListener('click',()=>window.print());
  $('exportPdfBtn').addEventListener('click',()=>window.print());
  $('printFinanceBtn').addEventListener('click',()=>window.print());
  $('backupBtn').addEventListener('click',downloadBackup);
  $('importInput').addEventListener('change',importBackup);
  $('clearAllBtn').addEventListener('click',clearAll);
  $('saveProfileBtn').addEventListener('click',saveProfile);
  $('themeBtn').addEventListener('click',toggleTheme);
  window.addEventListener('beforeinstallprompt',(e)=>{e.preventDefault();deferredPrompt=e;$('installBtn').classList.remove('hidden');});
  $('installBtn').addEventListener('click',async()=>{ if(deferredPrompt){deferredPrompt.prompt(); deferredPrompt=null; $('installBtn').classList.add('hidden'); }});
}

function showScreen(id){
  screens.forEach(s=>s.classList.toggle('active',s.id===id));
  navBtns.forEach(b=>b.classList.toggle('active',b.dataset.screen===id));
  renderAll();
}

function renderAll(){
  renderTop(); renderDashboard(); renderMonth(); renderWeek(); renderSearch(); renderFinance();
}

function renderTop(){
  const now = new Date();
  $('todayText').textContent = now.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
  const h = now.getHours();
  const saudacao = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  $('greeting').textContent = `${saudacao}, ${profile.name || 'Dra.'}`;
}

function renderDashboard(){
  const today = toDateInput(new Date());
  const todayAppts = byDate(today);
  const next = getNextAppointment();
  $('todayCount').textContent = todayAppts.length;
  $('dashboardTitle').textContent = `${profile.name || 'Dra.'}, hoje você tem ${todayAppts.length} consulta${todayAppts.length===1?'':'s'}`;
  $('nextAppointmentText').textContent = next ? `Próxima: ${next.time} - ${next.name}` : 'Nenhuma consulta futura encontrada.';
  $('nextMini').textContent = next ? `${formatDate(next.date)} às ${next.time}` : 'Nenhuma hoje';
  renderList($('todayList'), todayAppts, 'Nenhuma consulta hoje.');
  const upcoming = appointments.filter(a=>dateTime(a) >= new Date()).sort(sortAppt).slice(0,8);
  renderList($('upcomingList'), upcoming, 'Nenhuma consulta futura.');
}

function renderMonth(){
  const y = currentMonth.getFullYear(), m = currentMonth.getMonth();
  $('monthTitle').textContent = currentMonth.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  const first = new Date(y,m,1); const start = new Date(first); start.setDate(1-first.getDay());
  const grid = $('calendarGrid'); grid.innerHTML='';
  for(let i=0;i<42;i++){
    const d = new Date(start); d.setDate(start.getDate()+i);
    const key = toDateInput(d); const count = byDate(key).length;
    const cell = document.createElement('button'); cell.className='day-cell';
    if(d.getMonth()!==m) cell.classList.add('other');
    if(key===selectedDate) cell.classList.add('selected');
    cell.innerHTML = `<span class="day-number">${d.getDate()}</span>${count?`<span class="day-count">${count} consulta${count>1?'s':''}</span>`:''}`;
    cell.addEventListener('click',()=>{selectedDate=key; renderMonth(); renderSelectedDate();});
    grid.appendChild(cell);
  }
  renderSelectedDate();
}

function renderSelectedDate(){
  $('selectedDateTitle').textContent = `Consultas de ${formatDate(selectedDate)}`;
  renderList($('selectedDateList'), byDate(selectedDate), 'Nenhuma consulta neste dia.');
}

function renderWeek(){
  const start = new Date(currentWeek); const end = new Date(start); end.setDate(start.getDate()+6);
  $('weekTitle').textContent = `${formatDate(toDateInput(start))} até ${formatDate(toDateInput(end))}`;
  const grid = $('weekGrid'); grid.innerHTML='';
  for(let i=0;i<7;i++){
    const d = new Date(start); d.setDate(start.getDate()+i); const key = toDateInput(d); const list = byDate(key);
    const col = document.createElement('div'); col.className='week-day';
    col.innerHTML = `<h4>${d.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'})}</h4>`;
    if(!list.length) col.innerHTML += `<p class="muted">Livre</p>`;
    list.forEach(a=>{
      const item = document.createElement('div'); item.className='week-appt';
      item.innerHTML = `<strong>${a.time}</strong><br>${escapeHtml(a.name)}<br><span class="badge ${a.status}">${labelStatus(a.status)}</span>`;
      item.addEventListener('click',()=>openModal(a)); col.appendChild(item);
    });
    grid.appendChild(col);
  }
}

function renderSearch(){
  const q = ($('searchInput').value || '').trim().toLowerCase();
  if(!q){ $('searchResults').textContent='Digite um nome para buscar.'; $('searchResults').className='appointment-list empty-state'; return; }
  const results = appointments.filter(a=>a.name.toLowerCase().includes(q)).sort(sortAppt);
  renderList($('searchResults'), results, 'Nenhuma consulta encontrada.');
}

function renderFinance(){
  const now = new Date();
  const monthItems = appointments.filter(a=>{
    const d = new Date(a.date+'T00:00'); return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
  });
  const done = monthItems.filter(a=>a.status==='realizada');
  const total = done.reduce((sum,a)=>sum+(Number(a.value)||0),0);
  $('monthTotal').textContent = money(total);
  $('doneCount').textContent = done.length;
  $('pendingCount').textContent = monthItems.filter(a=>a.status==='marcada'||a.status==='remarcada').length;
  renderList($('financeList'), monthItems.sort(sortAppt), 'Nenhuma consulta neste mês.');
}

function renderList(container, list, empty){
  container.className='appointment-list'; container.innerHTML='';
  if(!list.length){container.textContent=empty; container.classList.add('empty-state'); return;}
  list.sort(sortAppt).forEach(a=>container.appendChild(appointmentNode(a)));
}

function appointmentNode(a){
  const div = document.createElement('div'); div.className='appointment-item';
  div.innerHTML = `<div class="appointment-main">
    <span class="appointment-time">${formatDate(a.date)} • ${a.time}</span>
    <strong>${escapeHtml(a.name)}</strong>
    <span class="badge ${a.status}">${labelStatus(a.status)}</span>
    ${a.note?`<small class="muted">${escapeHtml(a.note)}</small>`:''}
    ${a.value?`<small class="muted">Valor: ${money(Number(a.value))}</small>`:''}
  </div>
  <div class="item-actions">
    <button data-action="done">✓</button><button data-action="edit">Editar</button><button data-action="delete">Excluir</button>
  </div>`;
  div.querySelector('[data-action="edit"]').addEventListener('click',()=>openModal(a));
  div.querySelector('[data-action="delete"]').addEventListener('click',()=>deleteAppointment(a.id));
  div.querySelector('[data-action="done"]').addEventListener('click',()=>setStatus(a.id,'realizada'));
  return div;
}

function openModal(data={}){
  $('modalTitle').textContent = data.id ? 'Editar consulta' : 'Nova consulta';
  $('appointmentId').value = data.id || '';
  $('patientName').value = data.name || '';
  $('appointmentDate').value = data.date || selectedDate || toDateInput(new Date());
  $('appointmentTime').value = data.time || '';
  $('appointmentStatus').value = data.status || 'marcada';
  $('appointmentValue').value = data.value || '';
  $('appointmentNote').value = data.note || '';
  $('modal').classList.remove('hidden');
  setTimeout(()=>$('patientName').focus(),50);
}
function closeModal(){ $('modal').classList.add('hidden'); $('appointmentForm').reset(); }

function saveAppointment(e){
  e.preventDefault();
  const id = $('appointmentId').value || crypto.randomUUID();
  const item = {id,name:$('patientName').value.trim(),date:$('appointmentDate').value,time:$('appointmentTime').value,status:$('appointmentStatus').value,value:$('appointmentValue').value,note:$('appointmentNote').value.trim(),updatedAt:new Date().toISOString()};
  const idx = appointments.findIndex(a=>a.id===id);
  if(idx>=0) appointments[idx]=item; else appointments.push(item);
  selectedDate=item.date; currentMonth = new Date(item.date+'T00:00'); currentWeek = startOfWeek(new Date(item.date+'T00:00'));
  persist(); closeModal(); renderAll();
}
function deleteAppointment(id){ if(confirm('Excluir esta consulta?')){appointments=appointments.filter(a=>a.id!==id);persist();renderAll();} }
function setStatus(id,status){ const a=appointments.find(x=>x.id===id); if(a){a.status=status;persist();renderAll();} }

function downloadBackup(){
  const data = {version:3,exportedAt:new Date().toISOString(),profile,appointments};
  const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob); const a=document.createElement('a');
  a.href=url; a.download=`backup-agenda-psi-${toDateInput(new Date())}.json`; a.click(); URL.revokeObjectURL(url);
}
function importBackup(e){
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = () => { try{ const data=JSON.parse(reader.result); if(!Array.isArray(data.appointments)) throw new Error(); appointments=data.appointments; profile=data.profile||profile; persist(); localStorage.setItem(PROFILE_KEY,JSON.stringify(profile)); fillProfileInputs(); renderAll(); alert('Backup importado com sucesso!'); }catch{alert('Arquivo inválido.');} };
  reader.readAsText(file); e.target.value='';
}
function clearAll(){ if(confirm('Tem certeza? Isso apaga todas as consultas deste aparelho.')){appointments=[];persist();renderAll();} }
function saveProfile(){ profile.name=$('doctorName').value.trim(); profile.subtitle=$('doctorSubtitle').value.trim(); localStorage.setItem(PROFILE_KEY,JSON.stringify(profile)); renderTop(); alert('Perfil salvo!'); }
function fillProfileInputs(){ $('doctorName').value=profile.name||''; $('doctorSubtitle').value=profile.subtitle||''; }

function loadAppointments(){ try{return JSON.parse(localStorage.getItem(STORAGE_KEY))||[]}catch{return[]} }
function loadProfile(){ try{return JSON.parse(localStorage.getItem(PROFILE_KEY))||{name:'Dra.',subtitle:'Psicóloga Clínica'}}catch{return{name:'Dra.',subtitle:'Psicóloga Clínica'}} }
function persist(){ localStorage.setItem(STORAGE_KEY,JSON.stringify(appointments)); }
function byDate(date){ return appointments.filter(a=>a.date===date).sort(sortAppt); }
function sortAppt(a,b){ return (a.date+a.time).localeCompare(b.date+b.time); }
function dateTime(a){ return new Date(`${a.date}T${a.time||'00:00'}`); }
function getNextAppointment(){ return appointments.filter(a=>a.status!=='cancelada' && dateTime(a)>=new Date()).sort(sortAppt)[0]; }
function toDateInput(d){ const x=new Date(d); x.setMinutes(x.getMinutes()-x.getTimezoneOffset()); return x.toISOString().slice(0,10); }
function startOfWeek(d){ const x=new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate()-x.getDay()); return x; }
function formatDate(date){ return new Date(date+'T00:00').toLocaleDateString('pt-BR'); }
function money(v){ return (v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function labelStatus(s){ return {marcada:'Marcada',realizada:'Realizada',cancelada:'Cancelada',remarcada:'Remarcada'}[s]||s; }
function escapeHtml(str){ return String(str).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function toggleTheme(){ document.body.classList.toggle('dark'); localStorage.setItem('agenda_psi_theme',document.body.classList.contains('dark')?'dark':'light'); }
function applyTheme(){ if(localStorage.getItem('agenda_psi_theme')==='dark') document.body.classList.add('dark'); }
function registerSW(){ if('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(()=>{}); }
