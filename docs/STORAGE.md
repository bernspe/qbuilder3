# QBuilder Storage conventions
## uploaded icons
 - uploads/icons
## questionnaires
 - it is possible for the user to upload single variants of a questionnaire (e.g. as a commit). This single variant has to be created from the raw JSON. It should be in a format ready to get imported as a new original questionnaire
 - variants will go to uploads/questionnaires
 - naming convention: {variant_id}.json, e.g. "mina.json"
 - there has to be a way to prevent overwriting of existing variants by other users but allowing overwriting of own variants, e.g. by checking the ids of existing variants during labelling of a new variant and prohibiting the user to choose an existing id that belongs to another user. This can be implemented in the frontend by fetching the list of existing variants from the server and checking against the variant id for their new variant.
 - the original questionnaire will be stored in uploads/questionnaires as original_pgraph.json and can be retrieved by the user as a starting point
## TechStack
 - php script for uploading icons and questionnaires to the storage, which will be called from the frontend when a user uploads an icon or creates a variant. The php script will handle the file upload and return the URL of the uploaded file, which can then be stored in the database and used in the frontend to display the icon or questionnaire. The php Skript will autodiscover by file type where to place the file
 - php skript for retrieving the original questionnaire
 - php skript for retreiving a list of variants, which could be used as starting points alternatively to the original questionnaire and which will be used to check for variant labeling to prevent overwriting of existing variants by other users
 - php skripts will be placed in the /php folder (which is public/php during development) and will be called from the frontend via fetch requests to the corresponding endpoints, e.g. /php/upload.php for uploading icons and questionnaires, /php/get_original.php for retrieving the original questionnaire, and /php/get_variants.php for retrieving a list of variants. The php skripts will handle the file operations and return the necessary data to the frontend in JSON format.