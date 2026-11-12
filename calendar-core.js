/* Kalender im iCalendar-Format: Export (.ics) und Kalender-Abo (kalender.ics).
   Ohne Abhängigkeiten außer reminder-core.js, läuft im Browser und in Node.
   Uhrzeiten sind immer deutsche Ortszeit (Europe/Berlin); gerechnet wird nur mit
   Datumsstrings, damit die Zeitzone des Geräts oder Servers keine Rolle spielt. */
(function(root){
  'use strict';
  const RC=typeof module!=='undefined'?require('./reminder-core.js'):root.ReminderCore;
  const TZ='Europe/Berlin';
  /* Zeitraster der Hochschule (die Seite nutzt dieselbe Liste als SL) */
  const SLOTS=[{l:'08:00–09:30',sh:'08:00',eh:'09:30'},{l:'09:45–11:15',sh:'09:45',eh:'11:15'},{l:'11:30–13:00',sh:'11:30',eh:'13:00'},{l:'14:00–15:30',sh:'14:00',eh:'15:30'},{l:'15:45–17:15',sh:'15:45',eh:'17:15'},{l:'17:30–19:00',sh:'17:30',eh:'19:00'},{l:'19:15–20:45',sh:'19:15',eh:'20:45'}];
  /* Datei für das Kalender-Abo, liegt neben index.html */
  const FEED_FILE='kalender.ics';
  /* Vorlauf der Erinnerung im Abo, wenn state.json nichts anderes sagt */
  const DEFAULT_ALARM=15;
  /* Fester Zeitstempel im Abo: gleiche Daten ergeben byte-gleich dieselbe Datei,
     so entsteht beim Speichern nur dann ein Commit, wenn sich am Plan etwas ändert. */
  const FEED_STAMP='20260101T000000Z';
  const UID_HOST='miem-stundenplan';

  const toDate=s=>new Date(s+'T12:00:00Z');
  const iso=d=>d.toISOString().slice(0,10);
  const addDays=(s,n)=>{const d=toDate(s);d.setUTCDate(d.getUTCDate()+n);return iso(d);};
  const weekday=s=>(toDate(s).getUTCDay()+6)%7;   // 0 = Montag, wie termine[].day
  const isDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s);
  const holidayOn=(sem,ds)=>((sem&&sem.frei)||[]).find(h=>ds>=h.from&&ds<=(h.to||h.from))||null;
  const has=v=>v&&v!=='–';

  /* Vorlesungen und Zusatztermine im Zeitraum [from, to], begrenzt auf das Semester jedes Moduls.
     Übersprungen werden asynchrone Termine, Block/Sa (Termine n.V.), Ausfälle und vorlesungsfreie Tage. */
  function lectureEvents(modules,slots,semester,from,to){
    const out=[];
    for(const [key,m] of Object.entries(modules||{})){
      const modId=m.id||key;
      const starts=[from,m.semStart].filter(isDate).sort(),ends=[to,m.semEnd].filter(isDate).sort();
      const a=starts[starts.length-1],b=ends[0];
      const cancelled=new Set((m.exceptions||[]).filter(x=>x.type==='cancelled').map(x=>x.date));
      if(a&&b)for(const t of m.termine||[]){
        const sl=slots[t.slot];
        if(!sl||t.async||/asynchron/i.test(t.fmt||'')||!(t.day>=0&&t.day<5))continue;
        let ds=a;while(weekday(ds)!==t.day)ds=addDays(ds,1);
        for(;ds<=b;ds=addDays(ds,7)){
          if(cancelled.has(ds)||holidayOn(semester,ds))continue;
          out.push({kind:'lecture',key,modId,date:ds,slot:t.slot,startTime:sl.sh,endTime:sl.eh,label:t.lbl||modId,fmt:t.fmt||'',raum:t.raum||'–',name:m.name||modId,doz:m.doz||'–',link:RC.safeLink(t.link),kc:m.kc,moodle:m.moodle});
        }
      }
      for(const x of m.exceptions||[]){
        if(x.type!=='extra'||!isDate(x.date)||(isDate(from)&&x.date<from)||(isDate(to)&&x.date>to))continue;
        out.push({kind:'extra',key,modId,date:x.date,startTime:'',endTime:'',label:modId+' Zusatztermin',name:(m.name||modId)+(x.note?' ('+x.note+')':''),doz:m.doz||'–',fmt:'',raum:'–'});
      }
    }
    return out.sort(byStart);
  }

  /* Abgaben eines Moduls (modules[].abgaben): {date:'2026-12-02', time:'20:00', title:'Teilaufgabe 2', note:'…'}.
     Ohne gültige Uhrzeit gilt 23:59. Anders als Vorlesungen hängen Abgaben nicht an Semestergrenzen oder freien Tagen. */
  const isTime=s=>typeof s==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  function deadlineEvents(modules,from,to){
    const out=[];
    for(const [key,m] of Object.entries(modules||{})){
      const modId=m.id||key;
      for(const x of m.abgaben||[]){
        if(!x||!isDate(x.date)||!x.title||(isDate(from)&&x.date<from)||(isDate(to)&&x.date>to))continue;
        const time=isTime(x.time)?x.time:'23:59';
        out.push({kind:'deadline',key,modId,date:x.date,startTime:time,endTime:time,label:'Abgabe',title:String(x.title),note:x.note?String(x.note):'',name:m.name||modId,typ:m.typ,moodle:m.moodle});
      }
    }
    return out.sort(byStart);
  }

  /* Semestertermine und vorlesungsfreie Zeiten, die den Zeitraum berühren */
  function semesterEvents(semester,from,to){
    const a=isDate(from)?from:'0000-01-01',b=isDate(to)?to:'9999-12-31',out=[];
    for(const x of (semester&&semester.termine)||[])if(x.from<=b&&(x.to||x.from)>=a)out.push({kind:'sem',sem:true,date:x.from,to:x.to||x.from,startTime:x.start||'',endTime:x.end||'',name:x.title,label:'Semestertermin'});
    for(const h of (semester&&semester.frei)||[])if(h.from<=b&&(h.to||h.from)>=a)out.push({kind:'sem',sem:true,date:h.from,to:h.to||h.from,startTime:'',endTime:'',name:'Vorlesungsfrei: '+h.title,label:'Vorlesungsfrei'});
    return out;
  }

  function byStart(x,y){return (x.date+(x.startTime||'')).localeCompare(y.date+(y.startTime||''));}
  const esc=v=>String(v).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');
  const local=(d,t)=>d.replace(/-/g,'')+'T'+t.replace(/:/g,'')+'00';
  const slug=s=>String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'x';
  /* Feste Termin-IDs: Kalender-Apps erkennen einen Termin beim nächsten Abgleich wieder, statt ihn doppelt anzulegen */
  function uidOf(ev){
    const day=ev.date.replace(/-/g,'');
    if(ev.kind==='lecture')return `${day}-${ev.slot}-${slug(ev.modId)}-${slug(ev.label)}@${UID_HOST}`;
    if(ev.kind==='extra')return `${day}-zusatz-${slug(ev.modId)}@${UID_HOST}`;
    if(ev.kind==='deadline')return `${day}-abgabe-${slug(ev.modId)}-${slug(ev.title)}@${UID_HOST}`;
    return `${day}-sem-${slug(ev.name)}@${UID_HOST}`;
  }
  /* Erinnerungen an eine Abgabe: am Vortag um 18 Uhr und drei Stunden vor der Frist.
     Der Vortag zählt als Kalendertag (P1D), so bleibt es auch bei einer Zeitumstellung dazwischen bei 18 Uhr. */
  const WD=['Mo','Di','Mi','Do','Fr','Sa','So'];
  const dm=s=>s.slice(8,10)+'.'+s.slice(5,7)+'.';
  const hm=n=>(n>=60?Math.floor(n/60)+'H':'')+(n%60?n%60+'M':'');
  function valarm(trigger,text){return 'BEGIN:VALARM\r\nTRIGGER:'+trigger+'\r\nACTION:DISPLAY\r\nDESCRIPTION:'+esc(text)+'\r\nEND:VALARM\r\n';}
  function deadlineAlarms(ev){
    const [h,mi]=ev.startTime.split(':').map(Number);
    const toEve=h*60+mi+6*60;   // Minuten von Vortag 18:00 bis zur Frist
    const eve=toEve>=1440?'-P1D'+(toEve>1440?'T'+hm(toEve-1440):''):'-PT'+hm(toEve);
    const text=`Abgabe ${WD[weekday(ev.date)]} ${dm(ev.date)} um ${ev.startTime}: ${ev.modId} · ${ev.title}`;
    return valarm(eve,text)+valarm('-PT3H',text);
  }
  const VTIMEZONE='BEGIN:VTIMEZONE\r\nTZID:'+TZ+'\r\n'
    +'BEGIN:DAYLIGHT\r\nTZOFFSETFROM:+0100\r\nTZOFFSETTO:+0200\r\nTZNAME:CEST\r\nDTSTART:19700329T020000\r\nRRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU\r\nEND:DAYLIGHT\r\n'
    +'BEGIN:STANDARD\r\nTZOFFSETFROM:+0200\r\nTZOFFSETTO:+0100\r\nTZNAME:CET\r\nDTSTART:19701025T030000\r\nRRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU\r\nEND:STANDARD\r\n'
    +'END:VTIMEZONE\r\n';

  /* iCalendar-Text aus Terminen. alarmMinutes 1 bis 120 setzt eine Erinnerung vor jeder Vorlesung
     und die beiden Erinnerungen an jede Abgabe, sonst gibt es keine. */
  function buildICS(events,opts){
    const o=opts||{};
    const dtstamp=o.dtstamp||FEED_STAMP;
    let ics='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//MIEM Stundenplan//DE\r\nCALSCALE:GREGORIAN\r\n';
    if(o.publish)ics+='METHOD:PUBLISH\r\n';
    ics+='X-WR-CALNAME:'+esc(o.calName||'MIEM Stundenplan')+'\r\nX-WR-TIMEZONE:'+TZ+'\r\n';
    if(o.refresh)ics+='REFRESH-INTERVAL;VALUE=DURATION:'+o.refresh+'\r\nX-PUBLISHED-TTL:'+o.refresh+'\r\n';
    ics+=VTIMEZONE;
    for(const ev of events){
      ics+='BEGIN:VEVENT\r\nUID:'+uidOf(ev)+'\r\nDTSTAMP:'+dtstamp+'\r\n';
      if(ev.kind==='sem'){
        // Mit Startzeit als Zeitraum, sonst ganztägig (Endzeit steht dann im Titel)
        ics+=ev.startTime
          ?`DTSTART;TZID=${TZ}:${local(ev.date,ev.startTime)}\r\nDTEND;TZID=${TZ}:${local(ev.to,ev.endTime||ev.startTime)}\r\n`
          :`DTSTART;VALUE=DATE:${ev.date.replace(/-/g,'')}\r\nDTEND;VALUE=DATE:${addDays(ev.to,1).replace(/-/g,'')}\r\n`;
        ics+='SUMMARY:'+esc(ev.name+(!ev.startTime&&ev.endTime?' (bis '+ev.endTime+')':''))+'\r\nCATEGORIES:'+esc(ev.label)+'\r\nTRANSP:TRANSPARENT\r\nEND:VEVENT\r\n';
        continue;
      }
      if(ev.kind==='deadline'){
        // Abgaben sind ein Zeitpunkt ohne Dauer (wie in Moodle) und blockieren keine Zeit
        const at=`${TZ}:${local(ev.date,ev.startTime)}`;
        const desc=[ev.name];
        if(ev.note)desc.push(ev.note);
        if(has(ev.moodle))desc.push('Moodle: '+ev.moodle);
        ics+=`DTSTART;TZID=${at}\r\nDTEND;TZID=${at}\r\n`;
        ics+='SUMMARY:'+esc('Abgabe '+ev.modId+' · '+ev.title)+'\r\nDESCRIPTION:'+desc.map(esc).join('\\n')+'\r\nCATEGORIES:Abgabe\r\nTRANSP:TRANSPARENT\r\n';
        const url=RC.safeLink(ev.moodle);
        if(url)ics+='URL:'+url+'\r\n';
        if(o.alarmMinutes)ics+=deadlineAlarms(ev);
        ics+='END:VEVENT\r\n';
        continue;
      }
      if(ev.kind==='extra'){
        // Zusatztermine haben keine Uhrzeit: ganztägig und ohne Erinnerung
        ics+=`DTSTART;VALUE=DATE:${ev.date.replace(/-/g,'')}\r\nDTEND;VALUE=DATE:${addDays(ev.date,1).replace(/-/g,'')}\r\n`;
        ics+='SUMMARY:'+esc('Zusatztermin · '+ev.name+' ('+ev.modId+')')+'\r\n'+(has(ev.doz)?'DESCRIPTION:'+esc('Dozent: '+ev.doz)+'\r\n':'')+'TRANSP:TRANSPARENT\r\nEND:VEVENT\r\n';
        continue;
      }
      const room=has(ev.raum)?ev.raum:'Online';
      const desc=['Dozent: '+ev.doz,'Format: '+ev.fmt];
      if(ev.link)desc.push('Vorlesungslink: '+ev.link);
      if(has(ev.kc))desc.push('Kurscode: '+ev.kc);
      if(has(ev.moodle))desc.push('Moodle: '+ev.moodle);
      ics+=`DTSTART;TZID=${TZ}:${local(ev.date,ev.startTime)}\r\nDTEND;TZID=${TZ}:${local(ev.date,ev.endTime)}\r\n`;
      ics+='SUMMARY:'+esc(ev.label+' · '+ev.name)+'\r\nDESCRIPTION:'+desc.map(esc).join('\\n')+'\r\nLOCATION:'+esc(room)+'\r\n';
      if(ev.link)ics+='URL:'+ev.link+'\r\n';
      if(o.alarmMinutes)ics+=RC.alarm(o.alarmMinutes,[ev.label,ev.startTime+'–'+ev.endTime,has(ev.doz)?ev.doz:'',room,ev.fmt].filter(Boolean).join(' · '));
      ics+='END:VEVENT\r\n';
    }
    ics+='END:VCALENDAR\r\n';
    return RC.foldICS(ics);
  }

  /* Vorlauf aus state.json (kalenderAbo.erinnerungMin), sonst Standard */
  function feedAlarmMinutes(state){
    const n=Number(state&&state.kalenderAbo&&state.kalenderAbo.erinnerungMin);
    return Number.isInteger(n)&&n>=1&&n<=120?n:DEFAULT_ALARM;
  }
  /* Kalendername aus dem Semesterfeld, z. B. "MIEM Stundenplan · WiSe 2026/27" */
  function calendarName(semester){
    const term=String(semester||'').split('·')[0].trim();
    return 'MIEM Stundenplan'+(term?' · '+term:'');
  }
  /* Inhalt von kalender.ics: das ganze Semester aller Module plus Semestertermine und Abgaben */
  function feedCalendar(state){
    const s=state||{},sem=s.semesterTermine||{};
    const events=lectureEvents(s.modules,SLOTS,sem).concat(semesterEvents(sem),deadlineEvents(s.modules)).sort(byStart);
    return buildICS(events,{calName:calendarName(s.semester),alarmMinutes:feedAlarmMinutes(s),publish:true,refresh:'PT1H',dtstamp:FEED_STAMP});
  }

  const api={TZ,SLOTS,FEED_FILE,DEFAULT_ALARM,FEED_STAMP,lectureEvents,semesterEvents,deadlineEvents,buildICS,calendarName,feedAlarmMinutes,feedCalendar,uidOf,holidayOn,byStart};
  if(typeof module!=='undefined')module.exports=api;else root.CalendarCore=api;
})(globalThis);
