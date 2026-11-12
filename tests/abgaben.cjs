// Run: node tests/abgaben.cjs (requires playwright and Microsoft Edge; alternativ BROWSER_CHANNEL=chrome oder chromium).
// Prüft die Abgaben aus state.json mit gestellter Uhr: Wochenleiste, Banner "nächste Abgabe", Zeitachse,
// Moduldetails, Export, Erhalt beim Bearbeiten eines Moduls und die Handy-Breite.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
(async()=>{
  const root=path.resolve(__dirname,'..');
  const server=http.createServer(async(req,res)=>{
    try{
      const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
      if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
      const types={'.html':'text/html','.js':'application/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.ics':'text/calendar'};
      res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));
    }catch{res.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}/`;
  const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
  const open=async(width,time,view='agenda')=>{
    const context=await browser.newContext({timezoneId:'Europe/Berlin',locale:'de-DE',viewport:{width,height:900},serviceWorkers:'block'});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.clock.install({time:new Date(time)});
    await page.addInitScript(v=>{try{localStorage.setItem('miem-sp-view',v);}catch{}},view);
    await page.goto(origin);await page.waitForSelector('#main .ag-tabs, #main .tl-board');
    return {context,page,errors};
  };
  const chips=page=>page.evaluate(()=>[...document.querySelectorAll('#wk-strip .sem-chip.due')].map(c=>({text:c.textContent.replace(/\s+/g,' ').trim(),past:c.classList.contains('past')})));
  const banner=page=>page.evaluate(()=>{const b=document.querySelector('.next-banner.due');if(!b)return null;const r=b.getBoundingClientRect();return {text:b.textContent.replace(/\s+/g,' ').trim(),urgent:b.classList.contains('urgent'),inside:r.left>=0&&r.right<=innerWidth};});
  try{
    // Do 12.11.2026, 15:30: M1 ist heute um 23:59 fällig
    for(const width of [320,390,1400]){
      const {context,page,errors}=await open(width,'2026-11-12T15:30:00+01:00');
      const b=await banner(page);
      assert.ok(b,`Banner fehlt bei ${width} px`);
      assert.match(b.text,/MLIP · Projekt M1/);assert.match(b.text,/Do 12\.11\. 23:59/);assert.match(b.text,/8 h 29 min/);
      assert.ok(b.urgent,'unter 24 Stunden hervorgehoben');assert.ok(b.inside,`Banner ragt bei ${width} px heraus`);
      assert.deepEqual(await chips(page),[{text:'Do 12.11. 23:59 Abgabe MLIP · Projekt M1',past:false}]);
      await page.evaluate(()=>shiftWeek(1));
      assert.deepEqual((await chips(page)).map(c=>c.text),['Do 19.11. 23:59 Abgabe MLIP · Projekt M2','Fr 20.11. 23:59 Abgabe DESIM · 1. Optimization Baseline Model']);
      await page.evaluate(()=>shiftWeek(-3));   // KW 44: Abgabe IE am Mi 28.10., also auch an einem Tag ohne eigene Spalte
      assert.deepEqual(await chips(page),[{text:'Mi 28.10. 20:00 Abgabe INENG · Teilaufgabe 1',past:true}]);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`seitliches Wischen bei ${width} px`);
      assert.deepEqual(errors,[]);
      await context.close();
    }
    // Zeitachse KW 47: Abgaben im Kopf der Tagesspalten, Klick auf die Leiste öffnet die Moduldetails
    {
      const {context,page,errors}=await open(1400,'2026-11-12T15:30:00+01:00','timeline');
      await page.evaluate(()=>shiftWeek(1));
      const heads=await page.evaluate(()=>[...document.querySelectorAll('.tl-head')].map(h=>[...h.querySelectorAll('.tl-due')].map(p=>p.textContent).join('|')));
      assert.deepEqual(heads,['Abgabe 23:59','Abgabe 23:59','']);
      await page.locator('#wk-strip .sem-chip.due',{hasText:'DESIM'}).click();
      const rows=await page.evaluate(()=>{const r=[...document.querySelectorAll('#dm-rows .mrow')].find(x=>x.querySelector('.mlbl').textContent==='Abgaben');return r?[...r.querySelectorAll('.due-row')].map(d=>d.textContent.replace(/\s+/g,' ').trim()):null;});
      assert.deepEqual(rows,['Fr 20.11. 23:59 1. Optimization Baseline Model','Fr 04.12. 23:59 2. Energy Behaviour and Analysis · öffnet Fr 20.11. um 07:00','Fr 18.12. 23:59 3. Measures to improve Energy Consumption · öffnet Fr 04.12. um 07:00']);
      // Banner per Tastatur
      await page.evaluate(()=>closeOv('ov-detail'));
      await page.locator('.next-banner.due').focus();await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(()=>document.getElementById('ov-detail').classList.contains('open')&&document.getElementById('dm-title').textContent),'B6 – Machine Learning in der industriellen Produktion');
      assert.deepEqual(errors,[]);
      await context.close();
    }
    // Nach Mitternacht ist M1 vorbei, das Banner zeigt M2
    {
      const {context,page,errors}=await open(390,'2026-11-13T00:05:00+01:00');
      const b=await banner(page);
      assert.match(b.text,/MLIP · Projekt M2/);assert.match(b.text,/in 6 Tagen/);assert.equal(b.urgent,false);
      assert.deepEqual(await chips(page),[{text:'Do 12.11. 23:59 Abgabe MLIP · Projekt M1',past:true}]);
      // Nach der letzten Abgabe gibt es kein Banner mehr
      await page.clock.setSystemTime(new Date('2027-01-14T12:01:00+01:00'));await page.evaluate(()=>render());
      assert.equal(await banner(page),null);
      assert.deepEqual(errors,[]);
      await context.close();
    }
    // Export, Bearbeiten und Speichern behalten die Abgaben
    {
      const {context,page,errors}=await open(1400,'2026-11-12T15:30:00+01:00');
      const out=await page.evaluate(()=>{
        let content='';window.download=(name,value)=>{content=value;};
        openOv('ov-export');
        document.getElementById('ex-start').value='2026-11-16';document.getElementById('ex-end').value='2026-11-22';
        exportICS();const withDue=content;
        exportCSV();const csv=content;
        document.querySelector('.ex-cb[value="__DUE__"]').checked=false;
        exportICS();const without=content;
        closeOv('ov-export');
        return {withDue,csv,without};
      });
      assert.match(out.withDue,/SUMMARY:Abgabe MLIP · Projekt M2/);assert.match(out.withDue,/SUMMARY:Abgabe DESIM · 1\. Optimization Baseline Model/);
      assert.equal((out.withDue.match(/CATEGORIES:Abgabe/g)||[]).length,2);
      assert.match(out.csv,/"2026-11-20";"Fr";"23:59";"";"1\. Optimization Baseline Model";"DESIM";"Abgabe"/);
      assert.ok(!out.without.includes('CATEGORIES:Abgabe'));assert.match(out.without,/SUMMARY:DESIM:SU/);
      const kept=await page.evaluate(()=>{isAdmin=true;openEdit('DESIM');saveModule();const s=JSON.parse(JSON.stringify(buildState()));isAdmin=false;return {mod:M.DESIM.abgaben.length,state:s.modules.DESIM.abgaben.length,feed:(CalendarCore.feedCalendar(s).match(/CATEGORIES:Abgabe/g)||[]).length};});
      assert.deepEqual(kept,{mod:3,state:3,feed:10});
      assert.deepEqual(errors,[]);
      await context.close();
    }
    console.log('PASS: Abgaben in Wochenleiste (auch Mittwoch, vorbei markiert), Banner mit Restzeit und Tastatur, Zeitachsen-Kopf, Moduldetails, Export ICS/CSV mit und ohne Abgaben, Erhalt beim Bearbeiten, 320 bis 1400 px ohne seitliches Wischen');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
