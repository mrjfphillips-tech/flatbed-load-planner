"""Parse starter-question-bank.csv and output a TypeScript QUESTIONS array."""
import csv
import json
import os

csv_path = os.path.join(os.path.dirname(__file__), 'starter-question-bank.csv')

questions = []
with open(csv_path, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        text = row['question_text'].strip()
        element = row['meddic_element'].strip()
        persona = row.get('buyer_persona', '').strip()
        note = row.get('coaching_note', '').strip()
        if text and element:
            questions.append({
                'element': element,
                'text': text,
                'persona': persona,
                'note': note,
            })

# Output as TypeScript
lines = []
lines.append('// Auto-generated from starter-question-bank.csv')
lines.append(f'// {len(questions)} questions total')
lines.append('export const QUESTIONS: Array<{{ element: string; text: string; persona: string; note: string }}> = [')
for q in questions:
    t = json.dumps(q['text'])
    e = json.dumps(q['element'])
    p = json.dumps(q['persona'])
    n = json.dumps(q['note'])
    lines.append(f'  {{ element: {e}, text: {t}, persona: {p}, note: {n} }},')
lines.append(']')
lines.append('')

out_path = os.path.join(os.path.dirname(__file__), 'questions_generated.ts')
with open(out_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

print(f'Generated {len(questions)} questions -> {out_path}')
