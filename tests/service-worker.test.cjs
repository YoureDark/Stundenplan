const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup(clients=[]){
  const handlers={},opened=[];
  vm.runInNewContext(fs.readFileSync(require.resolve('../sw.js'),'utf8'),{
    URL,self:{registration:{scope:'https://example.org/Stundenplan/'},addEventListener:(type,fn)=>{handlers[type]=fn;},clients:{matchAll:async()=>clients,openWindow:async url=>opened.push(url)}},
  });
  return {opened,click:async(data,action='')=>{let work;handlers.notificationclick({action,notification:{data,close(){}},waitUntil:p=>{work=p;}});await work;}};
}
test('notification opens module details under the deployed repository path',async()=>{
  const sw=setup();await sw.click({url:'https://example.org/Stundenplan/?lecture=TEST'});
  assert.deepEqual(sw.opened,['https://example.org/Stundenplan/?lecture=TEST']);
});
test('notification focuses existing app and sends the module key',async()=>{
  let focused=false,message;
  const sw=setup([{url:'https://example.org/Stundenplan/',focus:async()=>{focused=true;},postMessage:m=>{message=m;}}]);
  await sw.click({url:'https://example.org/Stundenplan/?lecture=TEST'});
  assert.ok(focused);assert.equal(message.key,'TEST');assert.deepEqual(sw.opened,[]);
});
test('join action opens only a valid HTTPS lecture link',async()=>{
  const sw=setup();await sw.click({link:'https://teams.microsoft.com/meet/example'},'join');
  assert.deepEqual(sw.opened,['https://teams.microsoft.com/meet/example']);
  const unsafe=setup();await unsafe.click({link:'javascript:alert(1)',url:'https://evil.example/'},'join');
  assert.deepEqual(unsafe.opened,['https://example.org/Stundenplan/']);
});
