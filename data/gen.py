import csv, json, os

csv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'starter-question-bank.csv')
out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'packages', 'frontend', 'src', 'questions.ts')

questions = []
with open(csv_path, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        text = row['question_text'].strip()
        element = row['meddic_element'].strip()
        persona = row.get('buyer_persona', '').strip()
        note = row.get('coaching_note', '').strip()
        if text and element:
            questions.append({'element': element, 'text': text, 'persona': persona, 'note': note})

lines = []
lines.append('// Auto-generated from starter-question-bank.csv — DO NOT EDIT MANUALLY')
lines.append('// ' + str(len(questions)) + ' questions total')
lines.append('')
lines.append('export interface QuestionEntry {')
lines.append('  element: string')
lines.append('  text: string')
lines.append('  persona: string')
lines.append('  note: string')
lines.append('}')
lines.append('')
lines.append('export const QUESTIONS: QuestionEntry[] = [')
for q in questions:
    t = json.dumps(q['text'], ensure_ascii=False)
    e = json.dumps(q['element'])
    p = json.dumps(q['persona'])
    n = json.dumps(q['note'], ensure_ascii=False)
    lines.append('  { element: ' + e + ', text: ' + t + ', persona: ' + p + ', note: ' + n + ' },')
lines.append(']')
lines.append('')

# Build NOTES lookup from unique elements
elements = sorted(set(q['element'] for q in questions))
lines.append('/** Coaching notes by MEDDIC element */')
lines.append('export const NOTES: Record<string, string> = {')
note_map = {}
for q in questions:
    if q['element'] not in note_map:
        # Use first note for each element as the default coaching note
        short = q['note'][:120] + '...' if len(q['note']) > 120 else q['note']
        note_map[q['element']] = short
for el in elements:
    lines.append('  ' + json.dumps(el) + ': ' + json.dumps(note_map.get(el, ''), ensure_ascii=False) + ',')
lines.append('}')
lines.append('')

with open(out_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

print('Generated ' + str(len(questions)) + ' questions -> ' + out_path)
