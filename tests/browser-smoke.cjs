// Run: node tests/browser-smoke.cjs (requires playwright and Microsoft Edge).
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
(async()=>{
  const root=path.resolve(__dirname,'..');
  await fs.mkdir(path.join(root,'output'),{recursive:true});
  const server=http.createServer(async(req,res)=>{
    try{
      const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
      if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
      const types={'.html':'text/html','.js':'application/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
      res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));
    }catch{res.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
  try{
    const context=await browser.newContext({permissions:['notifications'],timezoneId:'America/New_York',viewport:{width:1280,height:900}});
    const errors=[];
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin);
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.waitForFunction(()=>typeof M==='object'&&document.querySelector('#main article'));
    await page.evaluate(()=>{
      window.testNotifications=[];
      ServiceWorkerRegistration.prototype.showNotification=async function(title,options){testNotifications.push({title,...options});};
      const realNow=Date.now();
      // Friday at 11:25 in Berlin, independently of the device timezone.
      Date.now=()=>Date.parse('2026-10-23T09:25:00Z');
      M={TEST:{id:'TEST',nr:'B1',name:'Testvorlesung',doz:'Prof. Test',typ:'base',semStart:'2026-10-01',semEnd:'2027-02-01',termine:[{day:4,slot:2,fmt:'Hybrid',raum:'KA.604',lbl:'TEST:SU',link:'https://example.org/meeting'}]}};
      localStorage.removeItem(SENT_KEY);
      localStorage.setItem(REMINDER_KEY,JSON.stringify({enabled:true,minutes:5,calendar:true}));
      window.realTestNow=realNow;
    });
    await page.evaluate(()=>checkReminders());
    await page.evaluate(()=>checkReminders());
    const sent=await page.evaluate(()=>testNotifications);
    assert.equal(sent.length,1);assert.match(sent[0].title,/TEST.*11:30–13:00/);
    assert.match(sent[0].body,/Prof\. Test/);assert.equal(sent[0].actions[0].action,'join');
    const other=await context.newPage();await other.goto(origin);
    await other.waitForFunction(()=>typeof M==='object');
    await other.evaluate(()=>{
      Date.now=()=>Date.parse('2026-10-23T09:25:00Z');
      M={TEST:{id:'TEST',termine:[{day:4,slot:2,lbl:'TEST:SU'}]}};
      window.duplicates=0;ServiceWorkerRegistration.prototype.showNotification=async()=>{duplicates++;};
    });
    await other.evaluate(()=>checkReminders());assert.equal(await other.evaluate(()=>duplicates),0);
    await other.close();
    await page.evaluate(()=>openSettings());
    await page.locator('#reminder-minutes').fill('15');await page.locator('#reminder-minutes').dispatchEvent('change');
    assert.equal(await page.evaluate(()=>reminderPrefs().minutes),15);
    await page.locator('#reminder-minutes').fill('0');await page.locator('#reminder-minutes').dispatchEvent('change');
    assert.equal(await page.evaluate(()=>reminderPrefs().minutes),15);
    await page.locator('#reminder-minutes').fill('15');
    await page.locator('#reminder-test').click();
    assert.equal(await page.evaluate(()=>testNotifications.length),2);
    const ics=await page.evaluate(()=>{
      closeSettings();openOv('ov-export');
      document.getElementById('ex-start').value='2026-10-23';document.getElementById('ex-end').value='2026-10-23';
      let content='';window.download=(name,value)=>{content=value;};exportICS();return content;
    });
    assert.match(ics,/TRIGGER:-PT15M/);assert.match(ics,/URL:https:\/\/example.org\/meeting/);
    assert.match(ics,/DTSTART;TZID=Europe\/Berlin:20261023T113000/);
    const noAlarm=await page.evaluate(()=>{const p=reminderPrefs();p.calendar=false;storeReminderPrefs(p);let content='';window.download=(n,v)=>{content=v;};exportICS();return content;});
    assert.ok(!noAlarm.includes('VALARM'));
    await page.evaluate(()=>{closeOv('ov-export');isAdmin=true;openEdit('TEST');});
    assert.equal(await page.locator('.tlink').inputValue(),'https://example.org/meeting');
    await page.locator('.tlink').fill('https://example.org/new-meeting');await page.evaluate(()=>saveModule());
    assert.equal(await page.evaluate(()=>M.TEST.termine[0].link),'https://example.org/new-meeting');
    await page.evaluate(()=>{showDetail('TEST');});
    assert.equal(await page.locator('#dm-moodle-row a[href="https://example.org/new-meeting"]').count(),1);
    await page.evaluate(async()=>{closeOv('ov-detail');isAdmin=false;openSettings();await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})));});
    await page.screenshot({path:'output/settings-desktop.png'});
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:'output/settings-mobile.png'});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await context.setOffline(true);await page.reload();
    await page.waitForFunction(()=>typeof ReminderCore==='object'&&typeof M==='object');
    assert.equal(await page.locator('#reminder-minutes').inputValue(),'15');
    assert.deepEqual(errors,[]);
    console.log('PASS: notification payload, due time, repeat/tab deduplication, preferences, validation, test notification, ICS alarms/opt-out, meeting links, mobile overflow, offline reload, no JS errors');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
