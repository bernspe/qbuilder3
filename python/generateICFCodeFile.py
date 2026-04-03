# read in icf_codes3.json which contains the ICF codes and their descriptions, and generate a python file with a dictionary that maps the ICF codes to their descriptions.
# take in only 4-digit ICF codes like d415, s720, etc. and ignore any codes that have more or less than 4 digits (like b2, d4150, s7200, etc.)
# source (icf_codes3.json): {code: {t = name, h = description,...}, ...}
# target (icf_codes_4digit.json): {code:{name,description}}
import json

def main():
    with open('icf_codes3.json', 'r') as f:
        icf_codes = json.load(f)
        for code in list(icf_codes.keys()):
            if len(code) != 4:
                del icf_codes[code]
            else:
                icf_codes[code] = {'name': icf_codes[code]['t'], 'description': icf_codes[code]['h']}
    with open('icf_codes_4digit.json', 'w') as f:
        json.dump(icf_codes, f, indent=4, ensure_ascii=False)

if __name__ == "__main__":
    main()