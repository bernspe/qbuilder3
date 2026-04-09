# QBuilder User Journey
Das Ziel des QBuilder ist das gemeinsame Erstellen einer Fragebogendatenbank zu Teilhabestörungen. 
Das Erfassen von Teilhabestörungen ist der wichtigste Schritt, um unserer Gesellschaft zu helfen das WARUM von Benachteiligung und das WIE 
des Lebens betroffener Menschen zu verstehen. Arbeiten wir gemeinsam an einer Zukunft füreinander!

Die User Journey umfasst die folgenden Schritte:
1. Automatisches Laden des Originals. Das Original ist die unvollständige Masterversion des Fragebogens. HIGHLIGHT auf die Treeview.
2. Der Benutzer legt eine Variante an. Diese Variante ist eine Kopie des Originals, die er nach Belieben editieren kann. Das Original bleibt unverändert. Der Name der Variante sollte für den Nutzer identifizierbar aber möglichst einzigartig sein, zum Beispiel Name-Ort-Datum. HIGHLIGHT auf den Button Variante anlegen. INTERAKTION des Benutzers einfordern und diesen Button drücken und Variante anlegen lassen. Achtung: hier muss ein Dialogmodal ermöglicht werden.
3. Die Variante muss angeklickt sein, damit sie bearbeitet werden kann. Sie sollte einmalig auf dem Server gespeichert werden, danach wird sie automatisch auf den Server gespeichert. HIGHLIGHT auf die soeben angelegte Variante und den Button "Auf Server speichern" und einfordern der Benutzeraktionen "Selektionieren der Variante" und "Speichern auf Server"
4. Danach HIGHLIGHT auf die TreeView und Aufforderung an den Benutzer, eine Frage zur Bearbeitung auszuwählen.
5. Im Editor können alle Elemente der Variante editiert werden. Schrittweises Erklären der einzelnen Elemente und Aufforderung an den Nutzer, hier etwas einzugeben - erst danach zu dem nächsten Element gehen: 
   6. Icon (Erklärung, wie das Icon erzeugt werden kann - entweder iconify oder Upload - beides HIGHLIGHTen), 
   7. Heading
   8. Question
   9. Answers (Erklären, wie die Optionen angelegt werden können und wie die RIchtung gut -> schlecht oder schlecht -> gut eingestellt werden kann)
   10. Referenz (Kommt diese Frage aus einem validierten Fragebogen?). 
   11. Danach HIGHLIGHT auf den Button "Neue Unterfrage" und Aufforderung an den Nutzer eine Unterfrage hinzuzufügen, um präzisere Informationen zu erlangen.
   12. Danach erfolgt der gleiche Run-Through für die Unterfrage, beginnend mit Schritt 6. bis 10. Danach soll der Nutzer die Treeview öffnen
13. Der Nutzer soll in der Treeview ein ICF-Item auswählen, um die ICF-Icons zu sehen. HIGHLIGHT auf die Treeview und Aufforderung an den Nutzer, ein ICF-Item auszuwählen.
   14. Öffnen des Editors, damit die Bearbeitung eines ICF-Items vorgestellt werden kann.
   15. HIGHLIGHT auf den ICF Code. Kurze Erklärung an den Nutzer, worum es sich hierbei handelt. Aufforderung an den Nutzer, dem Link zum ICF Mapper zu folgen, um die Möglichkeit kennenzulernen, aus normaler Sprache ICF Codes zu generieren.
   16. HIGHLIGHT auf den Fragentext und die Beispielfragen mit der Aufforderung auf die Beispielfrage zu klicken, die am Besten zu dem Konzept des ICF Codes passt. Alternativ kann die Frage auch selbst formuliert werden. 
17. In der Vorschau können die Fragen in der Preview angesehen werden. HIGHLIGHT auf die Tab-Auswahl Vorschau, Einfordern der Nutzeraktion
18. danach HIGHLIGHT auf die Rating-Felder für die aktuell selektionierte Frage.
19. Hat der Nutzer mitbekommen, dass er Punkte für seine Aktionen bekommen hat? 
20. Alle Aktionen können mit dem Undo-Button rückgängig gemacht werden.
21. Alle Änderungen werden automatisch gespeichert.
22. Der Nutzer wird am Ende zum Treeview zurückgeführt - mit der Aufforderung weitere Fragen zu beantworten.

Nach Eingang ausreichend vieler Varianten und Bewertungen wird eine finale Version der Fragebogendatenbank erstellt, die die Originale und die besten Varianten enthält.
