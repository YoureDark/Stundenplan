# MIEM Stundenplan

Statische Stundenplan-PWA ohne Build-Schritt. Läuft auf jedem Webserver, der die Dateien ausliefert (GitHub Pages, nginx, Caddy, eigener Server). Lokal z. B. mit `python -m http.server 8765` starten und `http://localhost:8765` öffnen. Es werden keine zusätzlichen Dienste benötigt.

## Kalender-Abo (Erinnerungen bei geschlossener App)

`kalender.ics` liegt neben `index.html` und enthält alle Vorlesungen des Semesters, jeweils mit einer Erinnerung vor Beginn, die Abgaben (siehe unten) mit zwei Erinnerungen, dazu die Semestertermine und vorlesungsfreien Zeiten (ohne Erinnerung). Ausfälle, vorlesungsfreie Tage, asynchrone Termine und Block/Sa-Termine nach Vereinbarung sind nicht enthalten. Jeder Termin hat eine feste ID, damit Kalender-Apps ihn beim nächsten Abgleich wiedererkennen statt ihn doppelt anzulegen.

- **Abonnieren:** Einstellungen → Vorlesungs-Erinnerungen → **Kalender abonnieren** (öffnet per `webcal://` den Abo-Dialog der Kalender-App) oder **Adresse kopieren** und in der Kalender-App als Abo hinzufügen. Die Adresse ergibt sich aus der Adresse, unter der die Seite geöffnet ist, also den Stundenplan auf dem Handy über die Server-Adresse öffnen, nicht über `localhost`.
- **iPhone:** In den Abo-Einstellungen „Alarme entfernen“ (je nach iOS „Hinweise entfernen“) ausschalten, sonst übernimmt das iPhone die Erinnerungen nicht. Die Erinnerungen liegen danach auf dem Handy und kommen auch, wenn der Server gerade nicht erreichbar ist. Der Server wird nur gebraucht, damit Änderungen ankommen; das iPhone gleicht Abos von selbst in Abständen ab, nicht sofort.
- **Android:** Mit einer Abo-App wie ICSx⁵ abonnieren.
- **Vorlauf:** `state.json` → `kalenderAbo.erinnerungMin` (1 bis 120, Standard 15). Als Admin unter Einstellungen → Vorlesungs-Erinnerungen änderbar; gilt für alle Abonnenten.
- **Aktualisieren:** „Speichern & ins Repo pushen“ schreibt `state.json` und `kalender.ics`. Unveränderte Dateien erzeugen keinen Commit. Wird `state.json` von Hand geändert, `node scripts/build-calendar.cjs` ausführen (`--check` prüft nur, ob `kalender.ics` noch passt).
- **Eigener Server:** `kalender.ics` wird wie jede andere Datei ausgeliefert, am besten als `text/calendar`. Holt sich der Server den Stand per `git pull` aus dem Repo, kommt die Datei automatisch mit. Damit Änderungen auch unterwegs ankommen, muss das Handy den Server erreichen (z. B. per Domain mit HTTPS oder VPN wie Tailscale). Ist der Server nur im Heimnetz erreichbar (die Domain zeigt z. B. auf eine 192.168.x.x-Adresse), das Abo direkt auf dem iPhone anlegen; am Mac als Ort „Auf meinem Mac“ statt iCloud wählen, weil Apples Server eine Heimnetz-Adresse nicht erreichen. Geht der Knopf nicht, die kopierte `https://`-Adresse von Hand als Kalenderabo hinzufügen. Für das Abo selbst reicht notfalls HTTP; die Benachrichtigungen der App brauchen dagegen HTTPS oder `localhost`.


## Abgaben

Abgabefristen stehen pro Modul in `state.json` unter `modules.<Kürzel>.abgaben`:

```json
"abgaben": [
  {"date": "2026-12-02", "time": "20:00", "title": "Teilaufgabe 2", "note": "Studienarbeit"}
]
```

`date` und `title` sind Pflicht, `time` ist deutsche Ortszeit (ohne Angabe 23:59), `note` ist ein optionaler Zusatz wie „öffnet Fr 20.11. um 07:00“. Abgaben hängen nicht an Semestergrenzen oder vorlesungsfreien Tagen.

- **In der App:** Die Leiste unter der Wochenauswahl zeigt die Abgaben der angezeigten Woche, auch an Tagen ohne eigene Spalte (z. B. Mittwoch); vorbei ist durchgestrichen. Darüber steht die nächste Abgabe mit Restzeit, unter 24 Stunden rot. In der Zeitachse trägt der Tageskopf „Abgabe 23:59“, die Moduldetails listen alle Abgaben des Moduls. Ein Klick auf eine Abgabe öffnet das Modul.
- **Im Kalender-Abo:** Jede Abgabe ist ein Termin ohne Dauer zur Fristzeit („Abgabe DESIM · 1. Optimization Baseline Model“), als frei markiert, mit Erinnerung am Vortag um 18 Uhr und drei Stunden vor der Frist. Auch der einmalige Export nimmt sie mit (Häkchen „Abgaben“).
- **Ändern:** `state.json` bearbeiten und `node scripts/build-calendar.cjs` ausführen. Ein Editor in der App fehlt noch; „Modul bearbeiten“ und „Speichern & ins Repo pushen“ behalten vorhandene Abgaben bei.

## Vorlesungs-Erinnerungen

Unter **Einstellungen → Vorlesungs-Erinnerungen** aktivieren, Browserberechtigung erteilen und bei Bedarf **Test senden** wählen. Standard: 5 Minuten vorher; einstellbar von 1 bis 120 Minuten. Einstellungen gelten nur für diesen Browser und werden nicht über `state.json` veröffentlicht.

Benachrichtigungen enthalten Modulkürzel, Modulname, Dozent, Beginn und Ende, Raum, Format, Terminlabel, vorhandene Hinweise und den optionalen Vorlesungslink. Die Aktion „Vorlesung öffnen“ öffnet diesen Link; ein Klick auf die Meldung öffnet die Moduldetails. Manche Betriebssysteme zeigen nur einen Teil des Texts bzw. keine Aktionsbuttons.

Die App prüft alle 15 Sekunden und beim Zurückkehren in den Tab. Zeiten beziehen sich immer auf **Europe/Berlin**, auch bei anders eingestelltem Gerät. Ferien, Ausfälle, Semestergrenzen und asynchrone Termine werden berücksichtigt. Bereits gestartete Vorlesungen erzeugen keine nachträglichen Meldungen. Web Locks verhindern doppelte Meldungen zwischen Tabs desselben Browsers; ohne Web Locks dient derselbe Notification-Tag als Ersatz. Sondertermine ohne konkrete Vorlesungszeit lösen keine Browser-Erinnerung aus.

**Die Web-App muss geöffnet bleiben.** Für Erinnerungen bei geschlossener App das Kalender-Abo oben nutzen. Benachrichtigungen funktionieren nur über HTTPS oder `localhost`; über `http://<IP-Adresse>` sperrt der Browser sie. Browser können Hintergrund-Tabs pausieren; im Schlafmodus oder bei gesperrtem Gerät sind Meldungen nicht verlässlich. Ein Service Worker allein kann keine verlässlichen zeitgesteuerten Meldungen bei geschlossener App auslösen. Dafür wäre ein zusätzlicher Web-Push-Dienst mit Scheduler und Push-Abonnements notwendig. Auf iOS/iPadOS die Web-App zunächst zum Home-Bildschirm hinzufügen; Browser und System müssen Benachrichtigungen unterstützen und erlauben. Fokusmodus/Systemeinstellungen können Meldungen unterdrücken.

## Einmaliger Kalenderexport

Statt des Abos geht auch ein einmaliger Export. „Erinnerungen auch in Kalenderexport aufnehmen“ ist standardmäßig aktiv und unabhängig von der Browserberechtigung. Beim `.ics`-Export werden `VALARM`-Erinnerungen mit dem eingestellten Vorlauf eingebettet. Den Export z. B. in Outlook oder Apple Kalender importieren und dort Benachrichtigungen erlauben. Ob importierte Alarme übernommen werden, hängt von der Kalender-App ab. Der Export ist eine Momentaufnahme: Nach Stundenplan- oder Vorlaufänderungen neu exportieren und alte Termine ersetzen, um Duplikate zu vermeiden.

## Vorlesungslinks

Als Admin unter **Modul bearbeiten → Termine** pro Termin einen optionalen HTTPS-Link eintragen. Er erscheint in Moduldetails, passenden Agenda-Buttons, Kalenderexport und Benachrichtigung. Das zusätzliche JSON-Feld heißt `termine[].link`. Vorhandene Module benötigen keine Migration. Anschließend wie gewohnt „Speichern & ins Repo pushen“ verwenden, um Änderungen am Stundenplan zu veröffentlichen.

## App-Icon

Editierbare Quelle: `icons/icon.svg`. Dunkler Kalender mit den blauen, grünen und goldenen Vorlesungsblöcken sowie roter Jetzt-Linie. PNGs in 180, 192 und 512 Pixeln plus eine deckende maskierbare Version sind eingecheckt. Browser-Favicon, Apple-Touch-Icon, Benachrichtigungen und PWA-Manifest nutzen die Dateien unter `icons/v2/`. Die versionierten Adressen verhindern, dass beim Hinzufügen weiterhin die alten Icon-Dateien aus einem Browser- oder Betriebssystem-Cache verwendet werden. Das Render-Skript aktualisiert diese Dateien aus der SVG-Quelle; ältere Dateien bleiben für bereits geladene App-Versionen erhalten. Betriebssysteme können bereits installierte Icons zwischenspeichern; gegebenenfalls die App neu installieren.

Zum erneuten Rendern mit Node.js und `sharp`: `node scripts/build-icons.cjs`. Die App selbst hat keine Laufzeit-Abhängigkeiten.

## Tests

`node --test tests/*.test.cjs` führt alle Unit-Tests aus. `tests/calendar-core.test.cjs` prüft das Kalender-Abo: alle 116 Vorlesungen mit Erinnerung, alle Abgaben mit ihren zwei Erinnerungen, freie Tage, Semestergrenzen, feste IDs, gleiche Datei unabhängig von der Zeitzone des Servers und dass `kalender.ics` zu `state.json` passt. `tests/reminder-core.test.cjs` prüft Vorlauf, verpasste Zeitfenster, Ferien, Ausfälle, Semestergrenzen, asynchrone Termine, sichere Links, Kalenderalarme, UTF-8-Zeilenfaltung und Sommer-/Winterzeit.

`node tests/browser-smoke.cjs` startet einen lokalen Testserver und prüft die Integration mit Playwright und Microsoft Edge (alternativ `BROWSER_CHANNEL=chrome`). Benötigt das Node-Paket `playwright`. Benachrichtigungsausgabe wird abgefangen, damit der Test keine Systemmeldungen auslöst. Geprüft werden Nutzdaten, Mehrfachaufrufe/mehrere Tabs, Einstellungsvalidierung, Testmeldung, Kalenderexport mit/ohne Alarm, Bearbeiten von Links, Kalender-Abo (Knopf, Adresse, Mitpushen beim Admin-Speichern), mobile Breite und Offline-Neuladen. Screenshots landen unter `output/`.

`node tests/mobile-layout.cjs` prüft mit gestellter Uhr die Handy-Ansicht von 320 bis 412 px: Tag-Reiter ohne seitliches Wischen, Ausfall-Schild innerhalb der Karte. Ohne Edge z. B. `BROWSER_CHANNEL=chromium` setzen.

`node tests/abgaben.cjs` prüft mit gestellter Uhr die Abgaben in der App: Wochenleiste, Banner mit Restzeit, Zeitachsen-Kopf, Moduldetails, Export und dass Bearbeiten eines Moduls die Abgaben behält, von 320 bis 1400 px.

## iPhone-Installationsdialog zeigt nur einen Buchstaben

Für iPhones, deren Hinzufügen-Dialog das über HTTPS abrufbare Icon nicht übernimmt, wird das 180×180-Apple-Touch-Icon direkt als PNG-Daten-URI im HTML eingebettet. Es wird ohne Transparenz aus derselben SVG-Quelle erzeugt; `node scripts/build-icons.cjs` aktualisiert sowohl `icons/v2/apple-touch-icon-180.png` als auch den HTML-Eintrag. Die Manifest-Icons bleiben normale PNG-Dateien. Das vermeidet einen zusätzlichen Icon-Netzwerkabruf im iOS-Installationsdialog. Die tatsächliche Anzeige dort muss auf dem betroffenen iPhone geprüft werden; Desktop-Browsertests bestätigen nur die eingebettete Bilddatei und die App-Funktion.
