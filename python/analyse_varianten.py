#!/usr/bin/env python3
"""
QBuilder3 Varianten-Analyse
============================
Vergleicht alle Servervarianten gegen das Original (original_pgraph.json)
und berechnet Punktzahlen nach derselben Logik wie useGamification.js,
inklusive Ratings (Wichtigkeit / Verständlichkeit), die seit dem Update
zusammen mit der Variante auf dem Server gespeichert werden.

Verwendung:
    python analyse_varianten.py --server https://qbuilder.example.com
    python analyse_varianten.py --server https://qbuilder.example.com --output bericht.txt
"""

import json
import sys
import argparse
import urllib.request
import urllib.parse
from collections import defaultdict

# ── Scoring-Konfiguration (spiegelt GAMIFICATION_CONFIG / useGamification.js) ─
CONFIG = {
    'newItemPoints':                 10,
    'removeItemPoints':               5,
    'maxRemovalItems':                5,
    'fillEmptyFieldPoints':           2,
    'changeFieldPoints':              1,
    'importanceRatingPoints':         2,
    'understandabilityRatingPoints':  2,
}

SCORABLE_TYPES = {'question', 'subquestion', 'icf'}
SCORED_FIELDS  = ['icon', 'question', 'reference', 'subheading',
                  'helpText', 'options', 'defaultIdx', 'answerOrder']


# ── HTTP-Hilfsfunktionen ───────────────────────────────────────────────────────

def fetch(url: str) -> str:
    try:
        with urllib.request.urlopen(url, timeout=15) as r:
            return r.read().decode('utf-8')
    except Exception as e:
        raise RuntimeError(f"GET {url} → {e}") from e


def fetch_json(url: str) -> dict:
    return json.loads(fetch(url))


# ── Datenstruktur-Hilfsfunktionen ──────────────────────────────────────────────

def flatten_scorable(nodes: list) -> list:
    """Alle bewertbaren Nodes rekursiv sammeln (wie _flattenScorable in JS)."""
    result = []
    def walk(lst):
        for n in lst:
            if n.get('type') in SCORABLE_TYPES:
                result.append(n)
            if n.get('children'):
                walk(n['children'])
            for b in n.get('branches', []):
                walk(b.get('children', []))
    walk(nodes)
    return result


def field_value(node: dict, field: str) -> str:
    """Feldwert normalisieren (wie _fieldValue in JS).

    JS-Verhalten für Arrays: null/undefined-Elemente werden wie in JS .join()
    als leerer String behandelt (nicht als 'None').
    """
    v = node.get(field)
    if v is None or v == '':
        return ''
    if isinstance(v, list):
        # JS: [null,'b'].join('\n') → '\nb'  (null → '')
        return '\n'.join('' if x is None else str(x) for x in v) if v else ''
    return str(v)


def extract_nodes(data: dict) -> list:
    """Nodes aus exportiertem JSON holen (unterstützt beide Formate)."""
    if 'variants' in data:
        first = next(iter(data['variants'].values()), {})
        return first.get('nodes', [])
    return data.get('nodes', [])


def extract_ratings(data: dict) -> dict:
    """ratings-Objekt aus exportiertem JSON holen.
    Format: { nodeId: { importance: int|null, understandability: int|null } }
    """
    return data.get('ratings', {})


# ── Scoring-Logik ──────────────────────────────────────────────────────────────

def calculate_score(orig_nodes: list, variant_nodes: list,
                    ratings: dict) -> tuple[int, dict]:
    """
    Punktzahl einer Variante gegen das Original berechnen.

    ratings: { nodeId: { importance: int|null, understandability: int|null } }

    Rückgabe:
        total     – Gesamtpunkte
        breakdown – { node_id: NodeResult }

    NodeResult-Keys:
        label, type, points, is_new, is_removed, changes,
        importance, understandability, rating_points
    """
    orig_items    = flatten_scorable(orig_nodes)
    variant_items = flatten_scorable(variant_nodes)
    orig_by_id    = {n['id']: n for n in orig_items}
    variant_by_id = {n['id']: n for n in variant_items}

    total     = 0
    breakdown = {}

    # Neue Items
    for n in variant_items:
        if n['id'] not in orig_by_id:
            pts = CONFIG['newItemPoints']
            total += pts
            breakdown[n['id']] = dict(
                label=n.get('label', '?'), type=n.get('type', '?'),
                points=pts, is_new=True, is_removed=False, changes=[],
                importance=None, understandability=None, rating_points=0)

    # Entfernte Items (gedeckelt)
    removed_count = 0
    for n in orig_items:
        if n['id'] not in variant_by_id and removed_count < CONFIG['maxRemovalItems']:
            pts = CONFIG['removeItemPoints']
            total += pts
            removed_count += 1
            breakdown[n['id']] = dict(
                label=n.get('label', '?'), type=n.get('type', '?'),
                points=pts, is_new=False, is_removed=True, changes=[],
                importance=None, understandability=None, rating_points=0)

    # Feldänderungen bei Items in beiden Varianten
    for n in variant_items:
        orig = orig_by_id.get(n['id'])
        if not orig:
            continue
        changes = []
        pts = 0
        for field in SCORED_FIELDS:
            ov = field_value(orig, field)
            nv = field_value(n, field)
            if ov == nv:
                continue
            if ov == '' and nv != '':
                changes.append((field, 'fill'))
                pts += CONFIG['fillEmptyFieldPoints']
            elif ov != '' and nv != '':
                changes.append((field, 'change'))
                pts += CONFIG['changeFieldPoints']
        total += pts
        breakdown[n['id']] = dict(
            label=n.get('label', '?'), type=n.get('type', '?'),
            points=pts, is_new=False, is_removed=False, changes=changes,
            importance=None, understandability=None, rating_points=0)

    # Rating-Punkte (wie calculatePoints in useGamification.js)
    for node_id, r in ratings.items():
        rating_pts = 0
        imp  = r.get('importance')
        und  = r.get('understandability')
        if imp  is not None: rating_pts += CONFIG['importanceRatingPoints']
        if und  is not None: rating_pts += CONFIG['understandabilityRatingPoints']
        total += rating_pts
        if node_id in breakdown:
            breakdown[node_id]['importance']        = imp
            breakdown[node_id]['understandability'] = und
            breakdown[node_id]['rating_points']     = rating_pts
        else:
            # Node im Rating vorhanden, aber nicht in Feldänderungen
            label = orig_by_id.get(node_id, {}).get('label', '?')
            ntype = orig_by_id.get(node_id, {}).get('type', '?')
            breakdown[node_id] = dict(
                label=label, type=ntype, points=0,
                is_new=False, is_removed=False, changes=[],
                importance=imp, understandability=und, rating_points=rating_pts)

    return total, breakdown


# ── Bericht ────────────────────────────────────────────────────────────────────

def sep(char='─', width=70) -> str:
    return char * width


def fmt_rating(val) -> str:
    return str(val) if val is not None else '–'


def report(orig_nodes: list, results: dict) -> str:
    lines = []
    w = lines.append

    orig_items = flatten_scorable(orig_nodes)
    orig_by_id = {n['id']: n for n in orig_items}

    w(sep('═'))
    w('QBuilder3  –  Varianten-Analyse')
    w(sep('═'))
    w('')

    # ── 1. Ranking ─────────────────────────────────────────────────────────────
    w(sep())
    w('1. GESAMTPUNKTZAHL PRO VARIANTE')
    w(sep())
    w('')
    ranked = sorted(results.items(), key=lambda x: x[1]['score'], reverse=True)
    for rank, (name, d) in enumerate(ranked, 1):
        bar = '█' * min(d['score'] // 5, 40)
        w(f"  {rank:2}. {name:<28} {d['score']:4} Pkt  {bar}")
    w('')

    # ── 2. Detail pro Variante ─────────────────────────────────────────────────
    w(sep())
    w('2. DETAILS PRO VARIANTE')
    w(sep())

    for name, d in ranked:
        w('')
        w(f"  ▸ {name}  ({d['score']} Pkt)")
        bd = d['breakdown']
        new_items     = [(i, n) for i, n in bd.items() if n['is_new']]
        removed_items = [(i, n) for i, n in bd.items() if n['is_removed']]
        changed_items = [(i, n) for i, n in bd.items()
                         if not n['is_new'] and not n['is_removed'] and n['points'] > 0]
        rated_items   = [(i, n) for i, n in bd.items() if n['rating_points'] > 0]
        unchanged     = len([n for n in bd.values()
                             if not n['is_new'] and not n['is_removed']
                             and n['points'] == 0 and n['rating_points'] == 0])

        if new_items:
            w(f"    Neue Items ({len(new_items)}):")
            for _, n in new_items:
                w(f"      + {n['label'][:42]:<42} [{n['type']}]  +{n['points']} Pkt")

        if removed_items:
            w(f"    Entfernte Items ({len(removed_items)}):")
            for _, n in removed_items:
                w(f"      − {n['label'][:42]:<42} [{n['type']}]  +{n['points']} Pkt")

        if changed_items:
            w(f"    Geänderte Items ({len(changed_items)}):")
            for _, n in sorted(changed_items, key=lambda x: x[1]['points'], reverse=True):
                fields_str = ', '.join(
                    f"{f}({'↑' if ct == 'fill' else '~'})" for f, ct in n['changes'])
                w(f"      ~ {n['label'][:36]:<36} [{n['type']}]  "
                  f"+{n['points']} Pkt  {fields_str}")

        if rated_items:
            w(f"    Bewertete Items ({len(rated_items)}):")
            for _, n in sorted(rated_items, key=lambda x: x[1]['rating_points'], reverse=True):
                w(f"      ★ {n['label'][:36]:<36} [{n['type']}]  "
                  f"+{n['rating_points']} Pkt  "
                  f"Wichtigkeit: {fmt_rating(n['importance'])}  "
                  f"Verständlichkeit: {fmt_rating(n['understandability'])}")

        w(f"    Unverändert / nicht bewertet: {unchanged}")

    w('')

    # ── 3. Node-Durchschnitt über alle Varianten ───────────────────────────────
    w(sep())
    w('3. NODE-BEITRAG: ÜBER-/UNTERDURCHSCHNITTLICH  (über alle Varianten)')
    w(sep())
    w('   Gesamtpunkte = Feldänderungen + Rating-Punkte')
    w('')

    node_pts_sum   = defaultdict(float)
    node_var_count = defaultdict(int)

    for _, d in results.items():
        for node_id, n in d['breakdown'].items():
            if node_id in orig_by_id and not n['is_removed']:
                node_pts_sum[node_id]   += n['points'] + n['rating_points']
                node_var_count[node_id] += 1

    if node_var_count:
        avg_per_node = {
            nid: node_pts_sum[nid] / node_var_count[nid]
            for nid in node_var_count
        }
        overall_avg = sum(avg_per_node.values()) / len(avg_per_node)

        w(f"  Gesamtdurchschnitt:  {overall_avg:.2f} Pkt / Variante")
        w('')

        above = [(i, a) for i, a in avg_per_node.items() if a > overall_avg]
        below = [(i, a) for i, a in avg_per_node.items() if 0 < a <= overall_avg]
        zero  = [i for i, a in avg_per_node.items() if a == 0]

        w(f"  Überdurchschnittlich ({len(above)} Nodes):")
        for nid, avg in sorted(above, key=lambda x: x[1], reverse=True):
            n = orig_by_id[nid]
            w(f"    ↑ {n.get('label','?')[:44]:<44} [{n.get('type','?')}]  Ø {avg:.1f} Pkt")

        w('')
        w(f"  Unterdurchschnittlich – mit Beitrag ({len(below)} Nodes):")
        for nid, avg in sorted(below, key=lambda x: x[1]):
            n = orig_by_id[nid]
            w(f"    ↓ {n.get('label','?')[:44]:<44} [{n.get('type','?')}]  Ø {avg:.1f} Pkt")

        if zero:
            w('')
            w(f"  Kein Beitrag in keiner Variante ({len(zero)} Nodes):")
            for nid in zero:
                n = orig_by_id[nid]
                w(f"    ○ {n.get('label','?')[:44]:<44} [{n.get('type','?')}]")

    w('')

    # ── 4. Rating-Statistik (Wichtigkeit / Verständlichkeit) ──────────────────
    w(sep())
    w('4. RATING-STATISTIK  (Wichtigkeit / Verständlichkeit)')
    w(sep())
    w('')

    # Aggregate ratings per original node across all variants
    imp_values  = defaultdict(list)   # node_id → [importance values]
    und_values  = defaultdict(list)   # node_id → [understandability values]

    for _, d in results.items():
        for node_id, n in d['breakdown'].items():
            if n['importance'] is not None:
                imp_values[node_id].append(n['importance'])
            if n['understandability'] is not None:
                und_values[node_id].append(n['understandability'])

    rated_nodes = set(imp_values.keys()) | set(und_values.keys())

    if rated_nodes:
        # Gesamtdurchschnitte
        all_imp = [v for vals in imp_values.values() for v in vals]
        all_und = [v for vals in und_values.values() for v in vals]
        avg_imp = sum(all_imp) / len(all_imp) if all_imp else None
        avg_und = sum(all_und) / len(all_und) if all_und else None
        w(f"  Ø Wichtigkeit gesamt:         {avg_imp:.2f}" if avg_imp is not None else "  Keine Wichtigkeits-Ratings")
        w(f"  Ø Verständlichkeit gesamt:    {avg_und:.2f}" if avg_und is not None else "  Keine Verständlichkeits-Ratings")
        w('')

        # Pro Node: Ø Wichtigkeit und Verständlichkeit
        w(f"  {'Node':<44} {'Typ':<12} {'Ø Wicht.':<10} {'Ø Verst.':<10} {'n'}")
        w(f"  {sep('─', 44)} {sep('─', 12)} {sep('─', 10)} {sep('─', 10)} {sep('─', 4)}")

        node_avgs = []
        for nid in rated_nodes:
            orig_n = orig_by_id.get(nid, {})
            i_vals = imp_values.get(nid, [])
            u_vals = und_values.get(nid, [])
            avg_i  = sum(i_vals) / len(i_vals) if i_vals else None
            avg_u  = sum(u_vals) / len(u_vals) if u_vals else None
            n_ratings = max(len(i_vals), len(u_vals))
            node_avgs.append((nid, orig_n, avg_i, avg_u, n_ratings))

        for nid, orig_n, avg_i, avg_u, n_r in sorted(
                node_avgs, key=lambda x: (x[2] or 0), reverse=True):
            label = orig_n.get('label', '?')
            ntype = orig_n.get('type', '?')
            si = f"{avg_i:.1f}" if avg_i is not None else '–'
            su = f"{avg_u:.1f}" if avg_u is not None else '–'
            w(f"  {label[:44]:<44} {ntype:<12} {si:<10} {su:<10} {n_r}")

        # Auffällige Nodes (≥1 unter Gesamtdurchschnitt)
        w('')
        w('  Unterdurchschnittliche Wichtigkeit:')
        flagged = [(nid, orig_by_id.get(nid,{}), avg_i, avg_u)
                   for nid, _, avg_i, avg_u, _ in node_avgs
                   if avg_i is not None and avg_imp is not None and avg_i < avg_imp]
        if flagged:
            for nid, orig_n, avg_i, avg_u in sorted(flagged, key=lambda x: x[2]):
                w(f"    ↓ {orig_n.get('label','?')[:44]:<44} Ø {avg_i:.1f}  (Ges.-Ø {avg_imp:.1f})")
        else:
            w('    (keine)')

        w('')
        w('  Unterdurchschnittliche Verständlichkeit:')
        flagged_u = [(nid, orig_by_id.get(nid,{}), avg_i, avg_u)
                     for nid, _, avg_i, avg_u, _ in node_avgs
                     if avg_u is not None and avg_und is not None and avg_u < avg_und]
        if flagged_u:
            for nid, orig_n, avg_i, avg_u in sorted(flagged_u, key=lambda x: x[3]):
                w(f"    ↓ {orig_n.get('label','?')[:44]:<44} Ø {avg_u:.1f}  (Ges.-Ø {avg_und:.1f})")
        else:
            w('    (keine)')
    else:
        w('  Keine Rating-Daten in den Varianten-Dateien vorhanden.')
        w('  (Ratings werden erst ab dem aktuellen App-Update mitgespeichert.)')

    w('')

    # ── 5. Node-Beitrag pro Variante ──────────────────────────────────────────
    w(sep())
    w('5. NODE-BEITRAG PRO VARIANTE')
    w(sep())

    for name, d in ranked:
        bd = d['breakdown']
        shared = [(i, n) for i, n in bd.items()
                  if not n['is_new'] and not n['is_removed']]
        if not shared:
            continue
        total_pts = [n['points'] + n['rating_points'] for _, n in shared]
        var_avg = sum(total_pts) / len(total_pts)
        above_v = [(i, n) for i, n in shared if n['points'] + n['rating_points'] > var_avg]
        below_v = [(i, n) for i, n in shared
                   if 0 < n['points'] + n['rating_points'] <= var_avg]

        w('')
        w(f"  ▸ {name}  (Varianten-Ø {var_avg:.1f} Pkt)")
        if above_v:
            w(f"    Überdurchschnittlich:")
            for _, n in sorted(above_v, key=lambda x: x[1]['points'] + x[1]['rating_points'], reverse=True):
                w(f"      ↑ {n['label'][:44]:<44} +{n['points'] + n['rating_points']} Pkt")
        if below_v:
            w(f"    Unterdurchschnittlich (>0):")
            for _, n in sorted(below_v, key=lambda x: x[1]['points'] + x[1]['rating_points']):
                w(f"      ↓ {n['label'][:44]:<44} +{n['points'] + n['rating_points']} Pkt")

    w('')

    # ── 6. Meistgeänderte Items ────────────────────────────────────────────────
    w(sep())
    w('6. MEISTGEÄNDERTE ITEMS  (Feldänderungen über alle Varianten)')
    w(sep())
    w('')

    field_counts = defaultdict(lambda: defaultdict(int))
    node_changes = defaultdict(int)
    node_meta    = {}

    for _, d in results.items():
        for node_id, n in d['breakdown'].items():
            if n['changes']:
                node_meta[node_id] = {'label': n['label'], 'type': n['type']}
                for field, _ in n['changes']:
                    field_counts[node_id][field] += 1
                    node_changes[node_id] += 1

    if node_changes:
        top = sorted(node_changes.items(), key=lambda x: x[1], reverse=True)
        w(f"  {'Item':<40} {'Typ':<12} {'Änd.':<6}  Felder (Häufigkeit)")
        w(f"  {sep('─', 40)} {sep('─', 12)} {sep('─', 6)}  {sep('─', 30)}")
        for node_id, total_ch in top:
            meta = node_meta[node_id]
            top_fields = sorted(field_counts[node_id].items(),
                                key=lambda x: x[1], reverse=True)
            fields_str = '  '.join(f"{f}×{c}" for f, c in top_fields[:5])
            w(f"  {meta['label'][:40]:<40} {meta['type']:<12} {total_ch:<6}  {fields_str}")
    else:
        w('  (keine Feldänderungen gefunden)')

    w('')
    w(sep('═'))

    return '\n'.join(lines)


# ── Hauptprogramm ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description='QBuilder3 Varianten-Analyse',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__)
    parser.add_argument('--server', required=True,
                        help='Server-Root-URL, z.B. https://qbuilder.example.com')
    parser.add_argument('--output', default=None,
                        help='Ausgabedatei (optional), z.B. bericht.txt')
    args = parser.parse_args()

    server = args.server.rstrip('/')

    # Original laden
    print('Lade Original …', end=' ', flush=True)
    orig_raw   = fetch(f"{server}/php/get_original.php")
    orig_data  = json.loads(orig_raw)
    orig_nodes = extract_nodes(orig_data)
    orig_count = len(flatten_scorable(orig_nodes))
    print(f"OK  ({orig_count} bewertbare Nodes)")

    # Variantenliste laden
    print('Lade Variantenliste …', end=' ', flush=True)
    variants_data = fetch_json(f"{server}/php/get_variants.php")
    variant_names = variants_data.get('variants', [])
    print(f"OK  ({len(variant_names)} Variante(n): {', '.join(variant_names)})")

    if not variant_names:
        print('Keine Varianten gefunden. Abbruch.')
        sys.exit(0)

    # Varianten laden und auswerten
    results = {}
    for name in variant_names:
        url = f"{server}/php/get_variant.php?name={urllib.parse.quote(name)}"
        print(f"  Analysiere '{name}' …", end=' ', flush=True)
        try:
            raw     = fetch(url)
            data    = json.loads(raw)
            nodes   = extract_nodes(data)
            ratings = extract_ratings(data)
            score, breakdown = calculate_score(orig_nodes, nodes, ratings)
            rated_count = sum(
                1 for r in ratings.values()
                if r.get('importance') is not None or r.get('understandability') is not None
            )
            rating_note = f"{rated_count} Nodes bewertet" if ratings else \
                "KEINE Ratings (Variante vor Rating-Update gespeichert → neu hochladen!)"
            print(f"{score} Pkt  [{rating_note}]")
            results[name] = {'score': score, 'breakdown': breakdown}
        except Exception as e:
            print(f"FEHLER: {e}")

    if not results:
        print('Keine Ergebnisse. Abbruch.')
        sys.exit(1)

    print()
    text = report(orig_nodes, results)
    print(text)

    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(text)
        print(f"\nBericht gespeichert → {args.output}")


if __name__ == '__main__':
    main()
