# Ablauf bei einer Datenpanne (Art. 33/34 DSGVO) – Pacepact

1. **Sofort eindämmen:** Anwendung offline nehmen oder Datenbank-Bindung beim Hoster entfernen; Zugangsdaten zum Hoster-Konto ändern; `ENCRYPTION_KEY` und Client-Secrets der Drittdienste erneuern (alle Verbindungen müssen danach neu hergestellt werden); alle Sitzungen löschen.
2. **Bewerten:** Welche Daten, wie viele Konten, welches Risiko? Pacepact speichert keine E-Mail-Adressen und keine Passwörter, aber ggf. Pulsdaten (Gesundheitsdaten) und Laufdaten. Ein Abfluss von Pulsdaten ist in der Regel meldepflichtig.
3. **Melden innerhalb von 72 Stunden** an die Datenschutzbehörde (https://www.dsb.gv.at → Formular „Data Breach“), außer es besteht voraussichtlich kein Risiko. Begründung dokumentieren.
4. **Betroffene informieren**, wenn ein hohes Risiko besteht – per Hinweis in der App (es gibt keine E-Mail-Adressen). Passkeys müssen nicht erneuert werden: Der Server kennt nur öffentliche Schlüssel.
5. **Dokumentieren** (Art. 33 Abs. 5): Was ist passiert, Auswirkungen, Maßnahmen – auch wenn nicht gemeldet wurde.
