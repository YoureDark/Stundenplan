/* Shared, dependency-free reminder rules. All timetable times are Europe/Berlin. */
(function(root){
  'use strict';
  const zone='Europe/Berlin';
  function parts(date){
    return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));
  }
  function dateInBerlin(date){const p=parts(date);return `${p.year}-${p.month}-${p.day}`;}
  function timestamp(date,time){
    const target=Date.parse(`${date}T${time}:00Z`);
    let value=target;
    for(let i=0;i<3;i++){
      const p=parts(new Date(value));
      value+=target-Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);
    }
    return value;
  }
  function safeLink(value){try{const u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return '';}}
  function locationText(t){return [t.raum&&t.raum!=='–'?t.raum:'',t.fmt].filter(Boolean).join(' · ')||'Ort noch offen';}
  function occurrences(modules,slots,semester,date){
    const day=(new Date(`${date}T12:00:00Z`).getUTCDay()+6)%7;
    if((semester.frei||[]).some(h=>date>=h.from&&date<=(h.to||h.from)))return [];
    const result=[];
    for(const [key,m] of Object.entries(modules)){
      if((m.semStart&&date<m.semStart)||(m.semEnd&&date>m.semEnd)||(m.exceptions||[]).some(e=>e.type==='cancelled'&&e.date===date))continue;
      for(const t of m.termine||[]){
        if(t.day!==day||t.async||/asynchron/i.test(t.fmt||'')||!slots[t.slot])continue;
        const s=slots[t.slot],start=timestamp(date,s.sh);
        const link=safeLink(t.link)||safeLink(m.link);
        result.push({key,modId:m.id||key,date,start,startTime:s.sh,endTime:s.eh,link,
          tag:`lecture:${key}:${date}:${t.slot}:${t.lbl||''}`,
          title:`${m.id||key} · ${s.sh}–${s.eh}`,
          body:[m.name,m.doz,locationText(t),t.lbl,link,m.hint&&m.hint!=='–'?m.hint:''].filter(Boolean).join('\n')});
      }
    }
    return result.sort((a,b)=>a.start-b.start);
  }
  function due(events,now,minutes){return events.filter(e=>e.start>now&&e.start-minutes*60000<=now);}
  function alarm(minutes,description){
    const n=Number(minutes);
    if(!Number.isInteger(n)||n<1||n>120)return '';
    const text=String(description).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
    return `BEGIN:VALARM\r\nTRIGGER:-PT${n}M\r\nACTION:DISPLAY\r\nDESCRIPTION:${text}\r\nEND:VALARM\r\n`;
  }
  function foldICS(text){
    const encoder=new TextEncoder();
    return text.split('\r\n').map(line=>{
      let result='',length=0;
      for(const char of line){
        const size=encoder.encode(char).length;
        if(length+size>75){result+='\r\n ';length=1;}
        result+=char;length+=size;
      }
      return result;
    }).join('\r\n');
  }
  const api={dateInBerlin,timestamp,safeLink,locationText,occurrences,due,alarm,foldICS};
  if(typeof module!=='undefined')module.exports=api;else root.ReminderCore=api;
})(globalThis);
