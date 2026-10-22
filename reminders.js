/* Personal preferences never enter state.json or GitHub sync. */
const REMINDER_KEY='miem-sp-reminders-v1';
const SENT_KEY='miem-sp-reminders-sent-v1';
let reminderBusy=false,reminderError='';
function reminderPrefs(){
  try{const p=JSON.parse(localStorage.getItem(REMINDER_KEY)||'{}');return {enabled:p.enabled===true,minutes:Number.isInteger(p.minutes)&&p.minutes>=1&&p.minutes<=120?p.minutes:5,calendar:p.calendar!==false};}
  catch{return {enabled:false,minutes:5,calendar:true};}
}
function storeReminderPrefs(p){
  try{localStorage.setItem(REMINDER_KEY,JSON.stringify(p));reminderError='';return true;}
  catch{reminderError='Einstellungen konnten nicht gespeichert werden. Bitte Browserspeicher erlauben.';renderReminderSettings();return false;}
}
function reminderSupported(){return isSecureContext&&'Notification' in window&&'serviceWorker' in navigator;}
function renderReminderSettings(){
  const p=reminderPrefs();
  document.getElementById('reminder-minutes').value=p.minutes;
  document.getElementById('reminder-calendar').checked=p.calendar;
  document.getElementById('reminder-enable').textContent=p.enabled?'Erinnerungen ausschalten':'Erinnerungen aktivieren';
  document.getElementById('reminder-enable').disabled=!reminderSupported();
  document.getElementById('reminder-test').disabled=!reminderSupported()||Notification.permission!=='granted';
  let text=!reminderSupported()?'Hier sind keine Systembenachrichtigungen verfügbar. Nutze den Kalenderexport. Auf iPhone/iPad die App zuerst zum Home-Bildschirm hinzufügen.':Notification.permission==='denied'?'Benachrichtigungen sind im Browser gesperrt. Bitte in den Website-Einstellungen freigeben.':p.enabled&&Notification.permission==='granted'?`Aktiv · ${p.minutes} Minuten vorher · Zeiten: Europe/Berlin`:'Browser-Erinnerungen ausgeschaltet';
  const next=ReminderCore.occurrences(M,SL,semInfo,ReminderCore.dateInBerlin(new Date())).find(e=>e.start>Date.now());
  if(p.enabled&&next)text+=` · Nächste Vorlesung heute: ${next.title}`;
  document.getElementById('reminder-status').textContent=reminderError||text;
}
function saveReminderSettings(){
  const input=document.getElementById('reminder-minutes');
  if(!input.reportValidity())return;
  const p=reminderPrefs();p.minutes=Number(input.value);p.calendar=document.getElementById('reminder-calendar').checked;
  if(storeReminderPrefs(p)){renderReminderSettings();checkReminders();}
}
async function toggleReminders(){
  if(!reminderSupported())return;
  const p=reminderPrefs();
  if(p.enabled){p.enabled=false;storeReminderPrefs(p);renderReminderSettings();return;}
  try{
    // Must run directly inside this button's user gesture, before other awaits.
    const permission=await Notification.requestPermission();
    p.enabled=permission==='granted';
    if(storeReminderPrefs(p)){renderReminderSettings();checkReminders();}
  }catch{reminderError='Aktivierung fehlgeschlagen. Bitte Browserberechtigungen prüfen.';renderReminderSettings();}
}
async function showLectureNotification(event,test=false){
  const registration=await navigator.serviceWorker.getRegistration();
  if(!registration?.active)throw new Error('Die App wird vorbereitet. Bitte in wenigen Sekunden erneut versuchen.');
  const appUrl=new URL('./',location.href);appUrl.searchParams.set('lecture',event.key);
  await registration.showNotification((test?'Test · ':'')+event.title,{
    body:event.body,tag:test?'miem-reminder-test':event.tag,icon:new URL('icons/icon-192.png',location.href).href,
    data:{url:appUrl.href,link:event.link},
    actions:event.link?[{action:'join',title:'Vorlesung öffnen'},{action:'schedule',title:'Stundenplan'}]:[],
  });
}
async function testReminder(){
  try{
    const next=ReminderCore.occurrences(M,SL,semInfo,ReminderCore.dateInBerlin(new Date())).find(e=>e.start>Date.now());
    await showLectureNotification(next||{key:Object.keys(M)[0]||'',title:'MIEM · 11:30–13:00',body:'Beispielvorlesung\nProf. Beispiel\nKA.604 · Hybrid\nDeine Erinnerungen sind bereit.',link:''},true);
    reminderError='Testbenachrichtigung gesendet. Falls sie nicht erscheint, bitte Fokusmodus und Systemeinstellungen prüfen.';
  }catch(e){reminderError=e.message;}
  renderReminderSettings();
}
async function checkReminders(){
  const p=reminderPrefs();
  if(reminderBusy||!p.enabled||!reminderSupported()||Notification.permission!=='granted')return;
  reminderBusy=true;
  const run=async()=>{
    const now=Date.now(),date=ReminderCore.dateInBerlin(new Date(now));
    let sent;try{sent=JSON.parse(localStorage.getItem(SENT_KEY)||'{}');}catch{sent={};}
    if(!sent||typeof sent!=='object'||Array.isArray(sent))sent={};
    sent=Object.fromEntries(Object.entries(sent).filter(([,time])=>Number.isFinite(time)&&time>now-2*86400000));
    for(const event of ReminderCore.due(ReminderCore.occurrences(M,SL,semInfo,date),now,p.minutes)){
      if(sent[event.tag])continue;
      await showLectureNotification(event);
      sent[event.tag]=now;localStorage.setItem(SENT_KEY,JSON.stringify(sent));
    }
  };
  try{if(navigator.locks)await navigator.locks.request('miem-lecture-reminders',run);else await run();}
  catch(e){reminderError=e.message;}
  finally{reminderBusy=false;}
}
function initReminders(){
  renderReminderSettings();checkReminders();
  setInterval(checkReminders,15000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){checkReminders();renderReminderSettings();}});
  addEventListener('storage',e=>{if(e.key===REMINDER_KEY){renderReminderSettings();checkReminders();}});
  const key=new URL(location.href).searchParams.get('lecture');
  if(key&&M[key])showDetail(key);
  navigator.serviceWorker?.addEventListener('message',e=>{if(e.data?.type==='open-lecture'&&M[e.data.key])showDetail(e.data.key);});
}
