// Erzeugt kalender.ics (Kalender-Abo) aus state.json.
//   node scripts/build-calendar.cjs          schreibt kalender.ics neu
//   node scripts/build-calendar.cjs --check  meldet nur, ob kalender.ics zu state.json passt (Exit-Code 1, wenn nicht)
// Die App schreibt die Datei beim Admin-Speichern ins Repo mit; das Skript ist für Änderungen an state.json
// von Hand oder für einen Server, der die Datei nach einem git pull selbst neu erzeugen soll.
const fs=require('node:fs');
const path=require('node:path');
const cal=require('../calendar-core.js');
const root=path.resolve(__dirname,'..');
const state=JSON.parse(fs.readFileSync(path.join(root,'state.json'),'utf8'));
const file=path.join(root,cal.FEED_FILE);
const next=cal.feedCalendar(state);
if(process.argv.includes('--check')){
  const current=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
  if(current===next){console.log(`${cal.FEED_FILE} ist aktuell.`);}
  else{console.error(`${cal.FEED_FILE} passt nicht zu state.json. Neu erzeugen mit: node scripts/build-calendar.cjs`);process.exitCode=1;}
}else{
  fs.writeFileSync(file,next);
  const events=(next.match(/BEGIN:VEVENT/g)||[]).length;
  const alarms=(next.match(new RegExp('TRIGGER:-PT'+cal.feedAlarmMinutes(state)+'M\\r\\n','g'))||[]).length;
  const deadlines=(next.match(/CATEGORIES:Abgabe\r\n/g)||[]).length;
  console.log(`${cal.FEED_FILE}: ${events} Termine, davon ${alarms} Vorlesungen mit Erinnerung ${cal.feedAlarmMinutes(state)} Minuten vorher`
    +` und ${deadlines} Abgaben mit Erinnerung am Vortag um 18 Uhr und 3 Stunden vorher.`);
}
