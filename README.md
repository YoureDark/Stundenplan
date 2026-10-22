# MIEM Stundenplan

Statische Stundenplan-PWA für GitHub Pages. Lokal z. B. mit `python -m http.server 8765` starten und `http://localhost:8765` öffnen. Auf GitHub Pages werden keine zusätzlichen Dienste benötigt.

## Vorlesungs-Erinnerungen

Unter **Einstellungen → Vorlesungs-Erinnerungen** aktivieren, Browserberechtigung erteilen und bei Bedarf **Test senden** wählen. Standard: 5 Minuten vorher; einstellbar von 1 bis 120 Minuten. Einstellungen gelten nur für diesen Browser und werden nicht über `state.json` veröffentlicht.

Benachrichtigungen enthalten Modulkürzel, Modulname, Dozent, Beginn und Ende, Raum, Format, Terminlabel, vorhandene Hinweise und den optionalen Vorlesungslink. Die Aktion „Vorlesung öffnen“ öffnet diesen Link; ein Klick auf die Meldung öffnet die Moduldetails. Manche Betriebssysteme zeigen nur einen Teil des Texts bzw. keine Aktionsbuttons.

Die App prüft alle 15 Sekunden und beim Zurückkehren in den Tab. Zeiten beziehen sich immer auf **Europe/Berlin**, auch bei anders eingestelltem Gerät. Ferien, Ausfälle, Semestergrenzen und asynchrone Termine werden berücksichtigt. Bereits gestartete Vorlesungen erzeugen keine nachträglichen Meldungen. Web Locks verhindern doppelte Meldungen zwischen Tabs desselben Browsers; ohne Web Locks dient derselbe Notification-Tag als Ersatz. Sondertermine ohne konkrete Vorlesungszeit lösen keine Browser-Erinnerung aus.

**Die Web-App muss geöffnet bleiben.** Browser können Hintergrund-Tabs pausieren; im Schlafmodus oder bei gesperrtem Gerät sind Meldungen nicht verlässlich. Ein Service Worker allein kann keine verlässlichen zeitgesteuerten Meldungen bei geschlossener App auslösen. Dafür wäre ein zusätzlicher Web-Push-Dienst mit Scheduler und Push-Abonnements notwendig. Auf iOS/iPadOS die Web-App zunächst zum Home-Bildschirm hinzufügen; Browser und System müssen Benachrichtigungen unterstützen und erlauben. Fokusmodus/Systemeinstellungen können Meldungen unterdrücken.

## Kalender als Alternative für geschlossene App

„Erinnerungen auch in Kalenderexport aufnehmen“ ist standardmäßig aktiv und unabhängig von der Browserberechtigung. Beim `.ics`-Export werden `VALARM`-Erinnerungen mit dem eingestellten Vorlauf eingebettet. Den Export z. B. in Outlook oder Apple Kalender importieren und dort Benachrichtigungen erlauben. Ob importierte Alarme übernommen werden, hängt von der Kalender-App ab. Der Export ist eine Momentaufnahme: Nach Stundenplan- oder Vorlaufänderungen neu exportieren und alte Termine ersetzen, um Duplikate zu vermeiden.

## Vorlesungslinks

Als Admin unter **Modul bearbeiten → Termine** pro Termin einen optionalen HTTPS-Link eintragen. Er erscheint in Moduldetails, passenden Agenda-Buttons, Kalenderexport und Benachrichtigung. Das zusätzliche JSON-Feld heißt `termine[].link`. Vorhandene Module benötigen keine Migration. Anschließend wie gewohnt „Speichern & ins Repo pushen“ verwenden, um Änderungen am Stundenplan zu veröffentlichen.

## App-Icon

Editierbare Quelle: `icons/icon.svg`. Dunkler Kalender mit den blauen, grünen und goldenen Vorlesungsblöcken sowie roter Jetzt-Linie. PNGs in 180, 192 und 512 Pixeln plus eine deckende maskierbare Version sind eingecheckt. Browser-Favicon, Apple-Touch-Icon, Benachrichtigungen und PWA-Manifest nutzen die Dateien unter `icons/v2/`. Die versionierten Adressen verhindern, dass beim Hinzufügen weiterhin die alten Icon-Dateien aus einem Browser- oder Betriebssystem-Cache verwendet werden. Das Render-Skript aktualisiert diese Dateien aus der SVG-Quelle; ältere Dateien bleiben für bereits geladene App-Versionen erhalten. Betriebssysteme können bereits installierte Icons zwischenspeichern; gegebenenfalls die App neu installieren.

Zum erneuten Rendern mit Node.js und `sharp`: `node scripts/build-icons.cjs`. Die App selbst hat keine Laufzeit-Abhängigkeiten.

## Tests

`node --test tests/reminder-core.test.cjs` prüft Vorlauf, verpasste Zeitfenster, Ferien, Ausfälle, Semestergrenzen, asynchrone Termine, sichere Links, Kalenderalarme, UTF-8-Zeilenfaltung und Sommer-/Winterzeit.

`node tests/browser-smoke.cjs` startet einen lokalen Testserver und prüft die Integration mit Playwright und Microsoft Edge (alternativ `BROWSER_CHANNEL=chrome`). Benötigt das Node-Paket `playwright`. Benachrichtigungsausgabe wird abgefangen, damit der Test keine Systemmeldungen auslöst. Geprüft werden Nutzdaten, Mehrfachaufrufe/mehrere Tabs, Einstellungsvalidierung, Testmeldung, Kalenderexport mit/ohne Alarm, Bearbeiten von Links, mobile Breite und Offline-Neuladen. Screenshots landen unter `output/`.

## iPhone-Installationsdialog zeigt nur einen Buchstaben

Für iPhones, deren Hinzufügen-Dialog das über HTTPS abrufbare Icon nicht übernimmt, wird das 180×180-Apple-Touch-Icon direkt als PNG-Daten-URI im HTML eingebettet. Es wird ohne Transparenz aus derselben SVG-Quelle erzeugt; `node scripts/build-icons.cjs` aktualisiert sowohl `icons/v2/apple-touch-icon-180.png` als auch den HTML-Eintrag. Die Manifest-Icons bleiben normale PNG-Dateien. Das vermeidet einen zusätzlichen Icon-Netzwerkabruf im iOS-Installationsdialog. Die tatsächliche Anzeige dort muss auf dem betroffenen iPhone geprüft werden; Desktop-Browsertests bestätigen nur die eingebettete Bilddatei und die App-Funktion.
