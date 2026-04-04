# Icons
 - naming convention:
    - icf: d415 -> d415.jpg, which is located at {VITE_IMAGESERVER}/icf-pics/d415.jpg
    - {iconset}:{icon}, which can be retrieved from the corresponding iconset, e.g. iconify:mdi-home -> mdi-home.svg from Iconify
    - svg: a string of svg code, which can be rendered as an inline svg
    - https: a URL from which the image can be retrieved, e.g. https://example.com/icon.png
 - upload of icons as image files:
    - additional functionality to upload icons as image files, which will then be stored on the server and can be retrieved via a URL. This would allow users to use custom icons that are not available in the predefined icon sets. File size limited to 500 kB
    - upload widget is accessible via a button in the question editing interface, which opens a file dialog for the user to select an image file from their device. Once the file is selected, it will be uploaded to the server and a URL will be generated for the uploaded icon and pasted in the icon input field.

# Fragetypen
#### Screeningfrage = question
Wird automatisch generiert, wenn ein neuer Abschnitt angelegt wird. 
Elemente der Screeningfrage:
* Icon: Ein generisches Icon, z.B. ein Fragezeichen oder ein Symbol, das den Faktor repräsentiert.
* Heading: Der Name des Abschnitts, z.B. "Körperliche Funktionsfähigkeit".
* Subheading: "Screeningfrage"
* Question: "Haben Sie Schwierigkeiten mit ...?" oder "Haben Sie Probleme mit ...?"
* Antwortmöglichkeiten: Ja/Nein oder Skala von 1-5, je nachdem, was für die Ermittlung der Relevanz am besten geeignet ist. Die Antwortmöglichkeiten sollten farblich als gradient abgestuft sein, wobei die Farbe semantisch zu den Antwortmöglichkeiten passt (z.B. Ja = rot, Nein = grün).
* Referenz: Quellenangabe, z.B. "SF36 Frage 1" oder "WHODAS Frage 1.1".

#### Untergeordnete Frage (freie Frage) = subquestion
Elemente der freien Frage:
* Icon: Ein generisches Icon, z.B. ein Fragezeichen oder ein Symbol, das den Inhalt der Frage repräsentiert.
* Heading: Der Name der Frage, z.B. "Anstrengende Tätigkeiten".
* Subheading: Der Name der übergeordneten Screeningfrage.
* Question: Die eigentliche Frage, z.B. "Wie stark haben Sie Schwierigkeiten mit anstrengenden Tätigkeiten?".
* Antwortmöglichkeiten: Die Antwortmöglichkeiten sollen als Buttons aus der Spalte answers generiert werden, dabei soll eine Vorbelegung des Buttons
mit default_idx erfolgen. Die Buttons sollen farblich als gradient abgestuft sein. Dabei soll die Farbe semantisch zu den Antwortmöglichkeiten passen (Starke Einschränkung = rot, keine = grün). Der Nutzer muss festlegen, ob die Antwortreihenfolge von schlecht -> gut oder umgekehrt ist.
* Referenz: Quellenangabe, z.B. "SF36 Frage 2" oder "WHODAS Frage 1.2".

#### ICF Item
* Icon: Das spezifische Icon für das ICF Item, das unter {VITE_IMAGESERVER}/icf-pics/${code}.jpg abgelegt ist, wobei code eine icf ist, z.B. d415. Das Icon soll automatisch generiert werden, sobald der Code eingegeben wird, indem der Code in der URL für die ICF Icons eingesetzt wird.
* Code: Der ICF Code, z.B. d415, wobei d für das Kapitel d der ICF steht.
  * Es sollen hilfreiche Links zur Findung des ICF Codes angezeigt werden: https://icfmapper.renecol.org, https://apps.who.int/classifications/icfbrowser/
* Heading: Der Name des ICF Items, z.B. "Stehen". =name aus der Mappingtabelle (assets/icf_codes_mit_fragen.json mit {code:{name,description, fragen}})
* Subheading: =description aus der Mappingtabelle (assets/icf_codes_mit_fragen.json mit {code:{name,description, fragen}})
* Question: Die eigentliche Frage, z.B. "Wie stark haben Sie Schwierigkeiten mit ... {ICF Name}?". Hier muss beachtet werden, dass nur die Kapitel d,b,s auf Einschränkungen abzielen. Im Kapitel e muss gefragt werden, wie star Einschränkungen oder Unterstützungen sind.
  * Dem Nutzer soll die Möglichkeit gegeben werden, aus Beispielfragen auszuwählen, die aus dem fragen-array der Mappingtabelle (assets/icf_codes_mit_fragen.json mit {code:{name,description, fragen}}) generiert werden, oder eine eigene Frage zu formulieren.
* Antwortmöglichkeiten:
  * ICF Items der Kapitel b,d,s haben prefixed answer sets: ['Keine Probleme','Wenige Probleme','Einige Probleme','Starke Probleme','Sehr starke Probleme oder gar nicht möglich']
  * ICF Items der Kapitel e haben prefixed answer sets: ['Dadurch vollständig beeinträchtigt','Dadurch stark beeinträchtigt','Dadurch mäßig beeinträchtigt','Dadurch leicht beeinträchtigt','Dadurch gar nicht beeinträchtigt','Unterstützt ein wenig','Unterstützt mäßig','Unterstützt substantiell','Beeinflussen mein Leben sehr stark postitiv']
Die Antwortmöglichkeiten sollen als Buttons generiert werden, dabei soll eine Vorbelegung des Buttons mit default_idx erfolgen. Die Buttons sollen farblich als gradient abgestuft sein. Dabei soll die Farbe semantisch zu den Antwortmöglichkeiten passen (Starke Einschränkung = rot, keine = grün), bei Kapitel e (Negativ = rot, Neutral = Gelb, Positiv = grün).
Sobald der Code für ein ICF Item eingegeben wird, soll automatisch der Heading, Subheading, Icon, Beispiel-Fragen und die Antwortmöglichkeiten generiert werden, indem der Code in einer Mappingtabelle (assets/icf_codes_mit_fragen.json mit {code:{name,description, fragen}}) gesucht wird. 
