// Run: node tests/mobile-layout.cjs (requires playwright and Microsoft Edge; alternativ BROWSER_CHANNEL=chrome oder chromium).
// Prüft die Handy-Punkte aus Review 6: Tag-Reiter passen ohne seitliches Wischen, das Ausfall-Schild bleibt in der Karte.
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
  const open=async(width,time)=>{
    const context=await browser.newContext({timezoneId:'Europe/Berlin',locale:'de-DE',viewport:{width,height:800},serviceWorkers:'block'});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.clock.install({time:new Date(time)});
    await page.goto(origin);await page.waitForSelector('#main .ag-tabs');
    return {context,page,errors};
  };
  try{
    for(const width of [320,360,375,390,412]){
      // Donnerstag mit Reiter "heute": längste Beschriftung
      const {context,page,errors}=await open(width,'2026-11-12T15:30:00+01:00');
      const tabs=await page.evaluate(()=>{const c=document.querySelector('.ag-tabs');const today=c.querySelector('.ag-tab.today'),label=today&&today.querySelector('.ag-today');return {overflow:c.scrollWidth-c.clientWidth,today:today?today.getAttribute('aria-current'):null,text:label?getComputedStyle(label).display:null};});
      assert.equal(tabs.overflow,0,`Tag-Reiter bei ${width} px abgeschnitten`);
      assert.equal(tabs.today,'date');assert.equal(tabs.text,'none');
      // Woche mit dem 24.12.: alle Karten fallen aus
      await page.evaluate(()=>{shiftWeek(6);setAgendaDay(3);});
      const badges=await page.evaluate(()=>[...document.querySelectorAll('.ag-item .ag-badge.off')].map(b=>{const c=b.closest('.ag-item').getBoundingClientRect(),r=b.getBoundingClientRect();return {text:b.textContent.trim(),inside:r.left>=c.left-0.5&&r.right<=c.right+0.5,title:b.title};}));
      assert.equal(badges.length,4);
      for(const b of badges){assert.ok(b.inside,`Ausfall-Schild ragt bei ${width} px aus der Karte`);assert.equal(b.text,'fällt aus · vorlesungsfrei');assert.match(b.title,/Weihnachten & Silvester/);}
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      assert.deepEqual(errors,[]);
      await context.close();
    }
    // Desktop: "· heute" bleibt als Text im Reiter
    const {context,page}=await open(1400,'2026-11-12T15:30:00+01:00');
    assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.ag-tab.today .ag-today')).display),'inline');
    await context.close();
    console.log('PASS: Tag-Reiter passen von 320 bis 412 px, Ausfall-Schild bleibt in der Karte, "heute" auf dem Desktop als Text');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
