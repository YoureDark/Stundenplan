const {test}=require('node:test');
const assert=require('node:assert/strict');
const r=require('../reminder-core.js');
const slots=[{sh:'11:30',eh:'13:00'}];
const modules={TEST:{id:'TEST',name:'Testvorlesung',doz:'Prof. Test',semStart:'2026-10-01',semEnd:'2027-02-01',termine:[{day:4,slot:0,fmt:'Hybrid',raum:'KA.604',lbl:'TEST:SU',link:'https://example.org/join'}]}};
const events=(mods=modules,sem={},date='2026-10-23')=>r.occurrences(mods,slots,sem,date);
test('Berlin summer and winter times, independent of host timezone',()=>{
  assert.equal(new Date(r.timestamp('2026-10-23','11:30')).toISOString(),'2026-10-23T09:30:00.000Z');
  assert.equal(new Date(r.timestamp('2026-10-30','11:30')).toISOString(),'2026-10-30T10:30:00.000Z');
  assert.equal(r.dateInBerlin(new Date('2026-10-22T23:30:00Z')),'2026-10-23');
});
test('DST transition dates remain at the correct lecture time',()=>{
  assert.equal(new Date(r.timestamp('2026-10-25','08:00')).toISOString(),'2026-10-25T07:00:00.000Z');
  assert.equal(new Date(r.timestamp('2027-03-28','08:00')).toISOString(),'2027-03-28T06:00:00.000Z');
});
test('includes module, professor, room, format, link and time',()=>{
  const [e]=events();assert.equal(e.title,'TEST · 11:30–13:00');
  for(const text of ['Testvorlesung','Prof. Test','KA.604','Hybrid','https://example.org/join'])assert.ok(e.body.includes(text));
});
test('five minute boundary, late wake-up, and no stale notification after start',()=>{
  const es=events(),start=es[0].start;
  assert.equal(r.due(es,start-300001,5).length,0);
  assert.equal(r.due(es,start-300000,5).length,1);
  assert.equal(r.due(es,start-1000,5).length,1);
  assert.equal(r.due(es,start,5).length,0);
  assert.equal(r.due(es,start+1000,5).length,0);
  assert.equal(r.due(es,start-15*60000,15).length,1);
});
test('holidays, cancellations, semester limits, async and wrong day are skipped',()=>{
  assert.deepEqual(events(modules,{frei:[{from:'2026-10-20',to:'2026-10-25'}]}),[]);
  for(const change of [{exceptions:[{date:'2026-10-23',type:'cancelled'}]},{semStart:'2026-10-24'},{semEnd:'2026-10-22'},{termine:[{day:4,slot:0,async:true}]},{termine:[{day:4,slot:0,fmt:'Asynchron'}]}])assert.deepEqual(events({TEST:{...modules.TEST,...change}}),[]);
  assert.deepEqual(events(modules,{},'2026-10-22'),[]);
});
test('unsafe meeting links cannot become notification actions',()=>{
  for(const url of ['javascript:alert(1)','data:text/html,test','http://example.org','invalid'])assert.equal(r.safeLink(url),'');
  assert.equal(r.safeLink('https://example.org/meeting'),'https://example.org/meeting');
});
test('calendar alarm uses requested lead time and escapes injected properties',()=>{
  const text=r.alarm(15,'TEST\nEND:VALARM;test,more');
  assert.ok(text.includes('TRIGGER:-PT15M\r\n'));
  assert.ok(text.includes('DESCRIPTION:TEST\\nEND:VALARM\\;test\\,more\r\n'));
  for(const n of [0,-1,121,1.5,NaN])assert.equal(r.alarm(n,'TEST'),'');
});
test('calendar lines fold at 75 UTF-8 octets without splitting umlauts',()=>{
  const original='DESCRIPTION:'+('Vorlesung äöü · Prof. Beispiel '.repeat(15));
  const folded=r.foldICS(original);
  assert.equal(folded.replace(/\r\n /g,''),original);
  for(const line of folded.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
});
