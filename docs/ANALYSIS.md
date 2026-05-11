# Analyse Funktionalität für qbuilder
qbuilder erlaubt das Erstellen neuer Fragebogen-Varianten auf Basis eines Originals.

Um die erstellten Varianten analysieren zu können, benötigt man eine grafische Visualisierung, welche Fragebogen-Bereiche besonders häufig bearbeitet (=geändert) wurden.
Dies wäre am besten als Heatmap in Form eines Sunburst Charts darzustellen. Dabei gibt es für jede Section einen eigenen Chart.
Im Inneren des Sunburst Charts finden sich die Screeningfragen und in den Ringen darum herum sind die Unterfragen oder ICF Items

## Zielgruppe der Analyse
Die Analyse richtet sich an die Ersteller der Varianten, um ihnen Feedback zu geben, welche Bereiche des Fragebogens besonders häufig bearbeitet wurden.
Außerdem soll die Analyse den Erstellern helfen, die Qualität ihrer Varianten zu verbessern, indem sie sehen können, welche Bereiche des Fragebogens besonders häufig bearbeitet wurden und welche Bereiche möglicherweise vernachlässigt wurden.

## Layout Anforderungen
 - In die Betrachtung einbezogene Varianten sollten auswählbar sein, um die Analyse auf bestimmte Varianten zu beschränken.
 - Es sollte möglich sein, die Analyse auf bestimmte Bereiche des Fragebogens zu beschränken, z.B. gezielt in eine Screeningfrage einzuzoomen
 - Die Heatmap sollte die Anzahl der Änderungen pro Fragebogen-Bereich darstellen, um zu zeigen, welche Bereiche besonders häufig bearbeitet wurden.
 - Gleichzeitig soll es möglich sein, die Varianten im Einzelnen zu betrachten und diese zu liken
 - Dabei wäre es sinnvoll, die Heatmap links zu positionieren und bei Click auf einen Bereich im Chart die dazugehörigen Unterfragen-Varianten und ICF-Item-Varianten auf der rechten Seite