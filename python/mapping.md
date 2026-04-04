# Mapping for conversion of data from excel to json
## origin
pgraph-questions.xlsx
## target example
fragebogen.json
## ICF source
icf_codes_mit_fragen.json

## column-wise xlsx mapping to json
- loc: hierarchyical location of the question in the question tree
  - format: "1.2.3" (section, question, subquestion or icf)
  - ignore: loc 0 and loc 0 subnodes
- category: reference
- heading: label
- question: question
- example: helpText
- answers: options
- default_idx: defaultIdx

ignore: q_order, icon

## Handling of ICF Items
if a row contains children, those children are comma-separated ICF items, whoch should be added as children to the question. 
The ICF items should be looked up in the icf_codes_mit_fragen.json file, and the corresponding name, description, example questions and answer options should be added to the question.
The mapping (icf_codes_mit_fragen.json -> target-json) is as follows:
 - code: icfCode
 - name: label
 - description: subheading
 - fragen: question = fragen[0]
Generate the icon field as follows: icf:{code}
questionType=single
options:
  * ICF Items of chapters b,d,s have prefixed answer sets: ['Keine Probleme','Wenige Probleme','Einige Probleme','Starke Probleme','Sehr starke Probleme oder gar nicht möglich']
  * ICF Items of chapter e have prefixed answer sets: ['Dadurch vollständig beeinträchtigt','Dadurch stark beeinträchtigt','Dadurch mäßig beeinträchtigt','Dadurch leicht beeinträchtigt','Dadurch gar nicht beeinträchtigt','Unterstützt ein wenig','Unterstützt mäßig','Unterstützt substantiell','Beeinflussen mein Leben sehr stark postitiv']
