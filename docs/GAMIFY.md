# Introduce Gamification into the QBuilder project
## Goals
 - create variant to be able to earn points
 - users shall read each node in the tree, its preview and rate its importance and understandability, to earn points
 - rating should be on 5point scale, with 1 being the lowest and 5 the highest rating
 - users shall be able to see their points and the leaderboard to encourage participation
 - users shall see their progress in the treeview, to encourage them to read all nodes and rate them
## KPIs
 - number of questions, subquestions and icf items either created, reviewed or rated by users
 - average rating given by users
 - distribution of ratings across items
 - correlation between points earned and user activity (e.g., time spent, number of items rated)
## Game mechanics:
 - points can only be earned if a variant has been created. The points will only be awarded to this very variant
 - therefore the points total will be displayed on the Variant item in the Variant Panel
 - points will be awarded in comparison of the variant with the original (=first item in Variant Panel)
   - new question, subquestion or icf item: 10 points, no points for new sections
   - rating of importance of a question, subquestion or icf item: 2 points
   - rating of understandability of a question, subquestion or icf item: 2 points
   - removal of a question, subquestion or icf item: 5 points for up to 5 items, after that no points will be awarded for removals
   - fill-in of empty fields (e.g. icon, question text, reference, etc.): 2 points per field
   - change of existing fields (e.g. icon, question text, reference, etc.): 1 point per field
## Layout
 - the points total of a variant will be displayed on the variant item in the variant panel, so that users can see how many points they have earned for this variant
 - each node in the treeview will have a visual indicator (e.g. a checkmark or a progress bar) to show the user which nodes they have already rated
 - the rating scales are displayed in the preview panel below each question, subquestion or icf item
