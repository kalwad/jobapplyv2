from pathlib import Path
import datetime
import hashlib
import json
import re
import subprocess

ROOT = Path('/Users/tanishkalwad/jobapplyv2')
OUT = Path('/tmp/japp-m02-w15-independent-audit/review-ready-metadata95f5')
EVIDENCE = ROOT / 'docs/evidence/m02-w15-review-95f5'
COMMIT = '95f5b09f43d9bef06d6158ea0bb8b9e0e3aa9123'
TREE = 'b85166b035fbf90a1b8c85d54f52461ccc422dd6'
DOCS = ['docs/COMPATIBILITY_MATRIX.md', 'docs/CRITICAL_GATES.md', 'docs/KNOWN_ISSUES.md', 'docs/PROJECT_STATUS.md', 'docs/TEST_EVIDENCE.md', 'docs/gates/AUTOFILL_FEASIBILITY_GATE.md']
checks = []

def check(name, value, observed=None):
    checks.append({'name': name, 'pass': bool(value), 'observed': observed})

def git(*args):
    p = subprocess.run(['git', *args], cwd=ROOT, capture_output=True, text=True)
    assert p.returncode == 0, (args, p.stderr)
    return p.stdout

def digest(data):
    return hashlib.sha256(data).hexdigest()

def identity(path):
    data = path.read_bytes()
    return {'path': str(path), 'bytes': len(data), 'sha256': digest(data)}

initial = {p: identity(ROOT / p) for p in DOCS}
check('HEAD remains evaluated commit', git('rev-parse', 'HEAD').strip() == COMMIT)
check('HEAD tree remains evaluated tree', git('rev-parse', 'HEAD^{tree}').strip() == TREE)
changed = git('diff', '--name-only', COMMIT).splitlines()
check('tracked delta is exactly six documentary files', sorted(changed) == sorted(DOCS), changed)
check('no staged delta', git('diff', '--cached', '--name-only').strip() == '')
untracked = git('ls-files', '--others', '--exclude-standard').splitlines()
newfiles = sorted(str(p.relative_to(ROOT)) for p in EVIDENCE.iterdir() if p.is_file())
check('untracked paths are exactly nine evidence files', untracked == newfiles and len(newfiles) == 9, untracked)
check('new evidence paths are safe regular non-symlink files', all(p.is_file() and not p.is_symlink() for p in EVIDENCE.iterdir()))

manifest = json.loads((EVIDENCE / 'source-retention-manifest.json').read_text())
check('copy manifest has exact source and no owner authority', manifest['candidate_commit'] == COMMIT and manifest['candidate_tree'] == TREE and manifest['authority'] == 'NONE' and manifest['owner_decision'] == 'PENDING' and manifest['authoritative_gate_state'] == 'IN_PROGRESS')
copies = []
for row in manifest['files']:
    source = Path(row['source'])
    copied = ROOT / row['repository_path']
    original_bytes, copied_bytes = source.read_bytes(), copied.read_bytes()
    same = original_bytes == copied_bytes and len(copied_bytes) == row['bytes'] and digest(copied_bytes) == row['sha256']
    copies.append({'source': str(source), 'copy': str(copied), 'bytes': len(copied_bytes), 'sha256': digest(copied_bytes), 'exact': same})
    check('exact sealed source copy: ' + copied.name, same)
check('exactly seven sealed source copies', len(copies) == 7)

verdict = json.loads((EVIDENCE / 'independent-verdict.json').read_text())
index = json.loads((EVIDENCE / 'candidate-index.json').read_text())
check('copied original actual independent verdict is PASS for exact candidate', verdict['recommendation'] == 'PASS' and verdict['candidate_commit'] == COMMIT and verdict['candidate_tree'] == TREE and verdict['blocking_findings'] == [])
check('verdict binds actual copied pack and index digests', verdict['predecision_pack']['sha256'] == 'sha256:' + digest((EVIDENCE / 'predecision-proof.tar.gz').read_bytes()) and verdict['predecision_index']['sha256'] == 'sha256:' + digest((EVIDENCE / 'candidate-index.json').read_bytes()))
check('independent PASS grants no owner/Gate/M03 authority', verdict['owner_decision'] == 'PENDING' and verdict['authoritative_gate_state'] == 'IN_PROGRESS' and verdict['gate_pass_authorized'] is False and verdict['M03_readiness_authorized'] is False and verdict['authority'] == 'INDEPENDENT_TECHNICAL_RECOMMENDATION_ONLY')
check('original predecision index still has no authority', index['authority'] == 'NONE' and index['gate_state'] == 'IN_PROGRESS' and index['owner_decision'] == 'PENDING')
check('lossless original 200 pointers preserved', index['original_canonical_result_count'] == 200 and len(index['current_result_references']) == 200 and len({r['result_id'] for r in index['current_result_references']}) == 200)
holdout = verdict['waiver_assessments']['holdout']
external = verdict['waiver_assessments']['direct_simplify_and_executed_public_forms']
check('waivers remain exact nonexecution rather than PASS', holdout['result'] == 'WAIVED_BY_OWNER_ADR_0006' and holdout['execution_performed'] is False and holdout['validity_established'] is False and external['result'] == 'WAIVED_BY_OWNER_ADR_0007' and external['execution_performed'] is False and external['actual_cases'] == 0)

texts = {p: (ROOT / p).read_text() for p in DOCS}
status = texts['docs/PROJECT_STATUS.md']
packages = re.findall(r'^\| `(M\d\d-W\d\d)` \| ([A-Z_]+) \|', status, re.M)
check('exact 300 packages with 32 VERIFIED and W15 sole IN_PROGRESS', len(packages) == 300 and sum(s == 'VERIFIED' for _, s in packages) == 32 and [p for p, s in packages if s == 'IN_PROGRESS'] == ['M02-W15'], {'total': len(packages), 'verified': sum(s == 'VERIFIED' for _, s in packages), 'in_progress': [p for p, s in packages if s == 'IN_PROGRESS']})
check('M02 unaccepted and M03 NOT_STARTED', re.search(r'^\| M02 \| IN_PROGRESS \|', status, re.M) is not None and re.search(r'^\| M03 \| NOT_STARTED \|', status, re.M) is not None and all(s == 'NOT_STARTED' for p, s in packages if p.startswith('M03-')))
check('project Gate A table remains IN_PROGRESS', re.search(r'^\| AUTOFILL_FEASIBILITY \| IN_PROGRESS \|', status, re.M) is not None)
critical = texts['docs/CRITICAL_GATES.md'].split('## AUTOFILL_FEASIBILITY\n', 1)[1].split('\n## CROSS_PLATFORM_CORE', 1)[0]
gate = texts['docs/gates/AUTOFILL_FEASIBILITY_GATE.md']
check('authoritative Gate and critical state agree at IN_PROGRESS', re.search(r'^- State: IN_PROGRESS$', critical, re.M) is not None and re.search(r'^- State: IN_PROGRESS$', gate, re.M) is not None)
check('authoritative actual owner decision still pending', '- Owner decision: pending' in critical and 'Owner decision: pending. Gate A remains IN_PROGRESS' in gate)
check('Next READY is NONE', re.search(r'## Next READY package\n\n- ID: NONE\n', status) is not None)
known = texts['docs/KNOWN_ISSUES.md']
sections = {}
for number in range(96, 101):
    match = re.search(r'^### KI-' + str(number).zfill(4) + r' .*?(?=^### |^## |\Z)', known, re.M | re.S)
    sections[number] = match.group(0) if match else ''
check('KI0096 through KI0099 are scoped FIXED with current pending-owner resolution', all('- State: FIXED' in sections[n] and 'Current resolution (2026-10-18UTC)' in sections[n] and 'owner Gate A decision remains pending' in sections[n] for n in range(96, 100)))
ki100 = sections[100]
check('KI0100 is MEDIUM OPEN future coordinator reuse only', '- Severity: MEDIUM' in ki100 and '- State: OPEN' in ki100 and 'future coordinator reuse precondition' in ki100 and 'normalize that CLI entry path' in ki100)
check('KI0100 preserves actual failed pipeline and separate pure comparison', 'Original pipeline exit1/FileNotFound' in ki100 and 'No product actor was repeated' in ki100 and 'separately reviewed join' in ki100 and 'relabel the original pipelinePASS' in ki100)
check('original failed native128 and missing original artifacts remain disclosed', '1662.986499999999' in sections[96] and '1644.6497500000005' in sections[96] and 'whole-testtimeout' in sections[96] and 'Original failure trace/screenshot remain lost' in sections[96] and 'old507a trace/screenshot remain unavailable' in sections[98])
check('rejected date/textarea proposals and original discovery failure remain historical', 'original date49b failure and eaf invalidtextarea/W09refusals remain unchanged' in sections[96] and 'Original3c79 discovery failure stays historical' in sections[99])
combined = '\n'.join(texts.values())
check('current native macOS one-sample threshold exceedance stays explicit', all('2423.20975' in texts[p] for p in DOCS if p != 'docs/KNOWN_ISSUES.md') and 'nottarget20acceptance' in gate and 'one' in combined.lower())
check('all principal current summaries preserve technical recommendation and pending owner', all('PASS' in texts[p] and ('owner' in texts[p].lower()) for p in DOCS))
reviewready = (EVIDENCE / 'review-ready.md').read_text()
check('review-ready corrected source anchor resolves to canonical specification', '[the canonical specification](../../MASTER_IMPLEMENTATION_SPEC.md), line 3043' in reviewready and (EVIDENCE / '../../MASTER_IMPLEMENTATION_SPEC.md').resolve() == ROOT / 'docs/MASTER_IMPLEMENTATION_SPEC.md')
spec_lines = (ROOT / 'docs/MASTER_IMPLEMENTATION_SPEC.md').read_text().splitlines()
check('line3043 is actual owner approval requirement', 'owner records approval' in spec_lines[3042] and 'M03' in spec_lines[3042])
check('review-ready preserves future UI obligations and no whole-product certification', 'Future product UI, accessibility, usability and visual approvals remain binding' in reviewready and 'whole-product usability or accessibility certification' in reviewready)
check('review-ready keeps current R10 pipeline failure and no actor replay', 'That failure remains FAIL' in reviewready and 'with no actor or coordinator replay' in reviewready)
check('review-ready retains exact original incorrect abstentions without recall credit', 'original 90 incorrect-abstention classifications remain' in reviewready and 'grants no extra fill or recall credit' in reviewready)

final = {p: identity(ROOT / p) for p in DOCS}
check('all six reviewed documentation bytes stable during bounded audit', initial == final)
files = [identity(ROOT / p) for p in DOCS] + [identity(p) for p in sorted(EVIDENCE.iterdir())]
result = {'scope': 'METADATA_ONLY_REVIEW_READY_PACKET_95F5', 'reviewer': '/root/gate_a_final_audit', 'observed_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'candidate_commit': COMMIT, 'candidate_tree': TREE, 'checks': checks, 'pass_count': sum(c['pass'] for c in checks), 'check_count': len(checks), 'blocking_findings': [c['name'] for c in checks if not c['pass']], 'sealed_copy_identity': copies, 'reviewed_file_identity': files, 'execution': {'product_or_test_source_authored': False, 'root_edited': False, 'tests_or_validators_run': False, 'browser_or_performance_actors_run': False, 'archived_code_imported': False, 'network_run': False}, 'authority': 'BOUNDED_INDEPENDENT_METADATA_REVIEW_ONLY', 'owner_decision': 'PENDING', 'authoritative_gate_state': 'IN_PROGRESS', 'gate_pass_authorized': False, 'M03_readiness_authorized': False, 'reader_history': ['Initial read referenced nonexistent docs/MASTER_SPEC.md; actual canonical docs/MASTER_IMPLEMENTATION_SPEC.md was then read and line3043 verified.', 'Initial selected KNOWN_ISSUES line range was unrelated; precise KI0099/KI0100 headings were located and read. Neither read changed root or executed source.'], 'root_documentary_checks': 'Root reports status45/trace193-300/format/diff green; this metadata review does not replay or independently certify those command executions.'}
(OUT / 'findings.json').write_text(json.dumps(result, indent=2) + '\n')
(OUT / 'reviewed-identities.json').write_text(json.dumps(files, indent=2) + '\n')
print(json.dumps({'pass_count': result['pass_count'], 'check_count': result['check_count'], 'blocking_findings': result['blocking_findings'], 'findings_sha256': digest((OUT / 'findings.json').read_bytes())}, indent=2))
