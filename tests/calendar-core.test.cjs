// Run: node --test tests/calendar-core.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const cal=require('../calendar-core.js');
const root=path.resolve(__dirname,'..');
const state=JSON.parse(fs.readFileSync(path.join(root,'state.json'),'utf8'));
const feed=cal.feedCalendar(state);
const vevents=text=>text.split('BEGIN:VEVENT\r\n').slice(1).map(v=>v.slice(0,v.indexOf('END:VEVENT')).replace(/\r\n /g,''));
const field=(v,name)=>(v.match(new RegExp('^'+name+'[;:]([^\\r\\n]*)','m'))||[])[1]||'';
// Semestertermine sind als frei markiert (TRANSP:TRANSPARENT), Vorlesungen nicht
const lectures=vevents(feed).filter(v=>!v.includes('TRANSP:TRANSPARENT'));

test('feed holds every lecture of the semester with a 15 minute alarm',()=>{
  // 14 Thursdays and 15 Fridays with 4 lectures each, without 24./25./31.12. and 01.01.
  assert.equal(lectures.length,116);
  assert.equal((feed.match(/BEGIN:VALARM/g)||[]).length,116);
  for(const v of lectures)assert.match(v,/BEGIN:VALARM\r\nTRIGGER:-PT15M\r\nACTION:DISPLAY\r\n/);
  const last=lectures.filter(v=>field(v,'DTSTART').endsWith('20270122T'+field(v,'DTSTART').slice(-6)));
  assert.equal(last.length,4,'last teaching day 22.01.2027');
});
test('feed skips holidays, lecture-free time, Block/Sa and anything outside the semester',()=>{
  for(const v of lectures){
    const day=field(v,'DTSTART').split(':')[1].slice(0,8);
    assert.ok(day>='20261002'&&day<='20270122',day);
    assert.ok(!(day>='20261224'&&day<='20270106'),'Weihnachten '+day);
    const weekday=new Date(`${day.slice(0,4)}-${day.slice(4,6)}-${day.slice(6)}T12:00:00Z`).getUTCDay();
    assert.ok(weekday===4||weekday===5,'only Thursday and Friday, got '+weekday);
  }
  assert.ok(!feed.includes('ASP:Pr'),'Praktikum n.V. is not a fixed calendar entry');
});
test('feed is a valid, publishable calendar with folded CRLF lines and unique stable ids',()=>{
  assert.ok(feed.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
  assert.ok(feed.endsWith('END:VCALENDAR\r\n'));
  assert.match(feed,/\r\nMETHOD:PUBLISH\r\n/);
  assert.match(feed,/\r\nX-WR-CALNAME:MIEM Stundenplan · WiSe 2026\/27\r\n/);
  assert.match(feed,/\r\nBEGIN:VTIMEZONE\r\nTZID:Europe\/Berlin\r\n/);
  assert.ok(!/[^\r]\n/.test(feed),'only CRLF line endings');
  for(const line of feed.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75,line);
  const uids=vevents(feed).map(v=>field(v,'UID'));
  assert.equal(new Set(uids).size,uids.length);
  assert.ok(uids.includes('20261002-2-ineng-ineng-su@miem-stundenplan'));
  assert.equal(vevents(feed).filter(v=>v.includes('TRANSP:TRANSPARENT')).length,7,'4 Semestertermine + 3 freie Zeiten');
});
test('lecture entries carry time zone, room, label first and the alarm text',()=>{
  const v=lectures.find(x=>field(x,'UID')==='20261002-2-ineng-ineng-su@miem-stundenplan');
  assert.equal(field(v,'DTSTART'),'TZID=Europe/Berlin:20261002T113000');
  assert.equal(field(v,'DTEND'),'TZID=Europe/Berlin:20261002T130000');
  assert.equal(field(v,'SUMMARY'),'INENG:SU · Industrial Engineering');
  assert.equal(field(v,'LOCATION'),'KA.604');
  assert.match(v,/DESCRIPTION:Dozent: Prof\. Dr\. Felderhoff Jan Fabian\\nFormat: Hybrid/);
  const online=lectures.find(x=>field(x,'SUMMARY').startsWith('MLIP:Ue'));
  assert.equal(field(online,'LOCATION'),'Online');
});
test('the same data gives a byte-identical file, independent of the server time zone',()=>{
  const before=process.env.TZ;
  try{
    for(const tz of ['UTC','America/Los_Angeles','Pacific/Kiritimati','Europe/Berlin']){process.env.TZ=tz;assert.equal(cal.feedCalendar(state),feed,tz);}
  }finally{if(before===undefined)delete process.env.TZ;else process.env.TZ=before;}
});
test('kalender.ics in the repository matches state.json',()=>{
  assert.equal(fs.readFileSync(path.join(root,cal.FEED_FILE),'utf8'),feed,'run: node scripts/build-calendar.cjs');
});
test('alarm lead time comes from kalenderAbo.erinnerungMin, invalid values fall back to 15',()=>{
  assert.equal(cal.feedAlarmMinutes({kalenderAbo:{erinnerungMin:30}}),30);
  for(const bad of [0,121,1.5,'15',null,undefined])assert.equal(cal.feedAlarmMinutes({kalenderAbo:{erinnerungMin:bad}}),15);
  assert.equal(cal.feedAlarmMinutes({}),15);
  assert.match(cal.feedCalendar({...state,kalenderAbo:{erinnerungMin:30}}),/TRIGGER:-PT30M/);
  const noAlarm=cal.buildICS(cal.lectureEvents(state.modules,cal.SLOTS,state.semesterTermine,'2026-10-23','2026-10-23'),{alarmMinutes:0});
  assert.ok(!noAlarm.includes('VALARM'));
});
test('export range is limited to the semester and keeps the last teaching day',()=>{
  const evs=cal.lectureEvents(state.modules,cal.SLOTS,state.semesterTermine,'2026-10-02','2027-01-22');
  assert.equal(evs.length,116);
  assert.equal(evs.filter(e=>e.date==='2027-01-22').length,4);
  assert.equal(cal.lectureEvents(state.modules,cal.SLOTS,state.semesterTermine,'2027-01-23','2027-04-30').length,0);
  assert.deepEqual(cal.lectureEvents(state.modules,cal.SLOTS,state.semesterTermine,'2026-10-23','2026-10-23').map(e=>e.label),['DESIM:SU','ASP:SU','INENG:SU','MLIP:SU']);
});
test('cancellations are skipped, extra dates become all-day entries without alarm',()=>{
  const m={id:'TEST',name:'Test; mit, Zeichen',doz:'Prof. Test',semStart:'2026-10-01',semEnd:'2026-10-31',
    termine:[{day:4,slot:2,fmt:'Hybrid',raum:'KA.604',lbl:'TEST:SU'}],
    exceptions:[{type:'cancelled',date:'2026-10-09'},{type:'extra',date:'2026-10-14',note:'Exkursion'},{type:'extra',date:'2026-12-01'}]};
  const evs=cal.lectureEvents({TEST:m},cal.SLOTS,{},'2026-10-01','2026-10-31');
  assert.deepEqual(evs.map(e=>e.date+':'+e.kind),['2026-10-02:lecture','2026-10-14:extra','2026-10-16:lecture','2026-10-23:lecture','2026-10-30:lecture']);
  const ics=cal.buildICS(evs,{alarmMinutes:10});
  const extra=vevents(ics).find(v=>v.includes('Zusatztermin'));
  assert.match(extra,/DTSTART;VALUE=DATE:20261014\r\nDTEND;VALUE=DATE:20261015/);
  assert.ok(!extra.includes('VALARM'));
  assert.match(ics,/SUMMARY:TEST:SU · Test\\; mit\\, Zeichen/);
  assert.equal((ics.match(/BEGIN:VALARM/g)||[]).length,4);
});
test('ids of existing lectures stay the same when another module is added',()=>{
  const more={...state,modules:{NEU:{id:'NEU',name:'Neu',semStart:'2026-10-02',semEnd:'2027-01-22',termine:[{day:3,slot:0,fmt:'Präsenz',raum:'A1',lbl:'NEU:SU'}]},...state.modules}};
  const ids=new Set(vevents(cal.feedCalendar(more)).map(v=>field(v,'UID')));
  for(const v of vevents(feed))assert.ok(ids.has(field(v,'UID')));
});
