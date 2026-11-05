from pathlib import Path
import hashlib
import json
import re
import subprocess
import tarfile

ROOT = Path('/Users/tanishkalwad/jobapplyv2')
BASE = '0f91158f68fa4fac4c5786b97b8d539d103d53ed'
OUT = Path('/tmp/japp-od037-metadata-review-20261018')
OUT.mkdir(exist_ok=True)
checks = []
def check(name, condition, detail=None):
    checks.append({'name': name, 'pass': bool(condition), 'detail': detail})
def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)
def old(path):
    return git('show', BASE + ':' + path)
def read(path):
    return (ROOT/path).read_bytes()
def sha(data):
    return hashlib.sha256(data).hexdigest()
def text(path):
    return read(path).decode()
def field(value, name):
    matches = re.findall(r'^\s*(?:[-*]\s*)?' + re.escape(name) + r':\s*(.*?)\s*$', value, re.M | re.I)
    return matches[-1] if matches else None
def section(value, heading):
    value = value.split(heading + '\n', 1)[1]
    return re.split(r'^##(?:#)? ', value, maxsplit=1, flags=re.M)[0].rstrip('\n') + '\n'

changed = git('diff','--name-only', BASE).decode().splitlines()
untracked = git('ls-files','--others','--exclude-standard').decode().splitlines()
allowed = {'CLAUDE.md','docs/COMPATIBILITY_MATRIX.md','docs/CRITICAL_GATES.md','docs/DECISIONS.md','docs/KNOWN_ISSUES.md','docs/PROJECT_STATUS.md','docs/REQUIREMENTS_TRACEABILITY.md','docs/TEST_EVIDENCE.md','docs/gates/AUTOFILL_FEASIBILITY_GATE.md','docs/traceability.json'}
check('changed tracked paths are only intended governance documents and live traceability', set(changed) <= allowed, changed)
check('new paths are only delegated evidence', all(p.startswith('docs/evidence/m02-w15-delegated-acceptance/') for p in untracked), untracked)
check('canonical master bytes preserved', read('docs/MASTER_IMPLEMENTATION_SPEC.md') == old('docs/MASTER_IMPLEMENTATION_SPEC.md') and sha(read('docs/MASTER_IMPLEMENTATION_SPEC.md')) == '3eba7bdfbbb1591b5ea54c31bc415fc0cbfd3c361d32005b328f27a12f3ac943')
decisions = text('docs/DECISIONS.md')
prior_decisions = old('docs/DECISIONS.md').decode()
for n, heading, domain, expected in [(6, '### ADR-0006 — Continuous execution and owner-controlled holdout waiver', b'japp-owner-holdout-waiver-v1\0', 'a76132ab96294a6e1b69c985ffd7f420ff6df96e3a121a579a734814c276647a'), (7, '### ADR-0007 — Direct Simplify comparison and executed public-form evidence waiver', b'japp-owner-external-evidence-waiver-v1\0', 'fc1529b286c358c36557e810e105d63a4cca6366b3fad913dee38dba4395df02')]:
    owner_id = 35 if n == 6 else 36
    row = re.findall(r'^\| OD-0' + str(owner_id) + r' \|.*$', decisions, re.M)
    prior_row = re.findall(r'^\| OD-0' + str(owner_id) + r' \|.*$', prior_decisions, re.M)
    body = section(decisions, heading)
    prior_body = section(prior_decisions, heading)
    check('ADR000%d and OD%03d exact record preserved' % (n,owner_id), len(row)==1 and row==prior_row and body==prior_body)
    digest=sha(domain + (row[0]+'\n'+heading+'\n'+body).encode())
    check('ADR000%d authority digest preserved' % n, digest==expected, digest)

authority=json.loads(text('docs/evidence/m02-w15-delegated-acceptance/delegation-authority.json'))
final=json.loads(text('docs/evidence/m02-w15-delegated-acceptance/final-decision.json'))
expected_reply='can you please not keep asking me these questions? Id really like it if you just kept moving through this project without stopping to ask me.'
check('authority cites actual user reply exactly',authority['owner_reply']==expected_reply)
check('authority preserves concrete source-bound question context', all(v in authority['question'] for v in ['95f5b09','5085d941','2c2e3d3b','b86bca46','This accepts M02 and unlocks M03']))
check('authority records delegation not a literal owner PASS',authority['record_type']=='OWNER_DELEGATION' and 'not a fabricated literal PASS response' in authority['interpretation'])
check('actual decision is delegated PASS with named maker and no manual click',final['record_type']=='DELEGATED_GATE_ACCEPTANCE' and final['result']=='PASS' and final['manual_owner_approval_click'] is False and final['owner_decision_method']=='DELEGATED_OWNER_AUTHORITY' and '/root under OD-037 / ADR-0008' in final['decision_maker'])
check('actual decision exact evaluated source and actual independent reviewer',final['evaluated_commit']=='95f5b09f43d9bef06d6158ea0bb8b9e0e3aa9123' and final['evaluated_tree']=='b85166b035fbf90a1b8c85d54f52461ccc422dd6' and final['independent_recommendation']=='PASS' and final['independent_reviewer']=='/root/gate_a_final_audit')
refs=final['evidence_chain']+[final['delegation_authority'],final['documentary_ci']['archive']]
for ref in refs:
    raw=read(ref['repository_path'])
    check('decision reference exact bytes/digest '+ref['repository_path'],len(raw)==ref['bytes'] and sha(raw)==ref['sha256'])
for path in ['docs/evidence/m02-w15-review-95f5/predecision-proof.tar.gz','docs/evidence/m02-w15-review-95f5/candidate-index.json','docs/evidence/m02-w15-review-95f5/independent-verdict.json','docs/evidence/m02-w15-review-95f5/independent-proof.tar.gz','docs/evidence/m02-w15-review-95f5/predecision-retention-manifest.json','docs/evidence/m02-w15-review-95f5/source-retention-manifest.json','docs/evidence/m02-w15-review-95f5/independent-archive-verification.json']:
    check('original predecision/review bytes preserved '+path,read(path)==old(path))
verdict=json.loads(text('docs/evidence/m02-w15-review-95f5/independent-verdict.json'))
check('original independent recommendation was PASS with no blockers',verdict['recommendation']=='PASS' and verdict['blocking_findings']==[] and verdict['all_actual_acceptance_checks_passed_within_declared_scope'] is True)
check('original independent predecision PENDING/IP flags remain historical',verdict['owner_decision']=='PENDING' and verdict['authoritative_gate_state']=='IN_PROGRESS' and verdict['gate_pass_authorized'] is False and verdict['M03_readiness_authorized'] is False)
check('waived observations stay unexecuted',final['waiver_assessments']['holdout']==verdict['waiver_assessments']['holdout'] and final['waiver_assessments']['direct_simplify_and_executed_public_forms']==verdict['waiver_assessments']['direct_simplify_and_executed_public_forms'])
ci_manifest=json.loads(text('docs/evidence/m02-w15-delegated-acceptance/documentary-ci-manifest.json'))
ci_ref=final['documentary_ci']['archive']
check('documentary CI manifest binds actual archive',ci_manifest['archive_bytes']==ci_ref['bytes'] and ci_manifest['archive_sha256']==ci_ref['sha256'] and ci_manifest['run_id']==final['documentary_ci']['run'] and ci_manifest['head_sha']==BASE and ci_manifest['actual_run_conclusion']=='success')
with tarfile.open(ROOT/ci_ref['repository_path'],'r:gz') as archive:
    members=archive.getmembers()
    check('documentary CI retained archive safe regular count',len(members)==ci_manifest['members']==490 and all(m.isfile() and not m.name.startswith('/') and '..' not in Path(m.name).parts for m in members))

status=text('docs/PROJECT_STATUS.md')
package_rows={m.group(1):(m.group(2),m.group(3),m.group(4)) for m in re.finditer(r'^\| `(M\d{2}-W\d{2})` \| ([A-Z_]+) \| ([^|]+) \| ([^|]+) \|',status,re.M)}
prior_status=old('docs/PROJECT_STATUS.md').decode()
prior_package_rows={m.group(1):(m.group(2),m.group(3),m.group(4)) for m in re.finditer(r'^\| `(M\d{2}-W\d{2})` \| ([A-Z_]+) \| ([^|]+) \| ([^|]+) \|',prior_status,re.M)}
check('300 package rows and 33 actual verified rows',len(package_rows)==300 and sum(r[0]=='VERIFIED' for r in package_rows.values())==33)
check('only M03W01 in progress and no READY',[(k,r[0]) for k,r in package_rows.items() if r[0]=='IN_PROGRESS']==[('M03-W01','IN_PROGRESS')] and not any(r[0]=='READY' for r in package_rows.values()))
check('prior 32 verified anchors preserved',all(package_rows[k]==v for k,v in prior_package_rows.items() if v[0]=='VERIFIED'))
check('M02W15 exact verified source anchor',package_rows['M02-W15'][0]=='VERIFIED' and package_rows['M02-W15'][1].strip()=='tree '+final['evaluated_tree'])
check('M02 accepted and M03 active with honest release state','| M02 | ACCEPTED | tree '+final['evaluated_tree'] in status and '| M03 | IN_PROGRESS |' in status and field(status,'Current milestone')=='M03' and field(status,'Current work package')=='M03-W01' and field(status,'Overall release gate')=='NOT_READY')

ledger=text('docs/CRITICAL_GATES.md').split('## AUTOFILL_FEASIBILITY\n',1)[1].split('\n## ',1)[0]
gate=text('docs/gates/AUTOFILL_FEASIBILITY_GATE.md')
for label,value in [('ledger',ledger),('report',gate)]:
    check(label+' authoritative final PASS/source/corpus/reviewer fields',field(value,'State')=='PASS' and field(value,'Evaluated revision')=='tree '+final['evaluated_tree'] and field(value,'Corpus/holdout hash')=='sha256:'+final['corpus_sha256'] and field(value,'Independent reviewer')==final['independent_reviewer'])
    check(label+' owner decision explicitly delegated',field(value,'Owner decision').startswith('PASS (delegated acceptance under OD-037 / ADR-0008; decision-maker /root; not a manual owner approval click)'))
    check(label+' final holdout exact waiver token',field(value,'Holdout result')=='WAIVED_BY_OWNER_ADR_0006')
    for f in ['Simplify comparison result','Public-form evidence result']:
        vals=re.findall(r'^\s*(?:[-*]\s*)?'+re.escape(f)+r':\s*(.*?)\s*$',value,re.M|re.I)
        check(label+' single exact '+f,vals==['WAIVED_BY_OWNER_ADR_0007'])

meta=json.loads(text('docs/traceability.json'));prior_meta=json.loads(old('docs/traceability.json'))
mp={r['id']:r for r in meta['work_packages']};pmp={r['id']:r for r in prior_meta['work_packages']}
diffs=[]
for k,r in mp.items():
    for f,v in r.items():
        if v!=pmp[k][f]:diffs.append((k,f))
check('only intended live trace package fields changed',set(diffs)=={('M02-W15','current_state'),('M02-W15','verified_revision'),('M02-W15','current_evidence'),('M03-W01','current_state')},diffs)
check('M02 evidence own heading and M03 no completed evidence',mp['M02-W15']['current_evidence']==[{'path':'docs/TEST_EVIDENCE.md','heading':'### M02-W15'}] and mp['M03-W01']['current_evidence']==[] and mp['M03-W01']['verified_revision']=='—')
gate_diffs=[]
pg={r['id']:r for r in prior_meta['critical_gates']}
for r in meta['critical_gates']:
    for f,v in r.items():
        if v!=pg[r['id']][f]:gate_diffs.append((r['id'],f))
check('only intended live gate field changed',gate_diffs==[('AUTOFILL_FEASIBILITY','current_state')])
check('all other traceability metadata and hash projections preserved',all(meta[k]==v for k,v in prior_meta.items() if k not in ['work_packages','critical_gates']))
adr8=section(decisions,'### ADR-0008 — Delegated project acceptance without routine approval prompts')
check('new ADR accepted accurately quotes owner and requires later actual review','- Status: ACCEPTED\n' in adr8 and expected_reply in adr8 and 'actual independent recommendation is PASS' in adr8 and 'no future baseline is approved' in adr8)
check('new ADR forbids fabricated owner observations and preserves actual evidence','must never claim that the owner clicked PASS, inspected an image, performed a study, or supplied an unobserved result' in adr8 and 'actual capture and independent accessibility/visual review' in adr8)
check('new ADR preserves external action and safety boundaries','PR merging' in adr8 and 'live applications/submissions' in adr8 and 'no trust-boundary, product behavior, scoring, threshold, model, corpus, or external-execution change' in adr8)
check('registry new OD row remains contiguous with owner table','| OD-036' in decisions and re.search(r'^\| OD-036[^\n]*\n\| OD-037',decisions,re.M) is not None)
check('registry new ADR row remains contiguous with ADR table',re.search(r'^\| ADR-0007[^\n]*\n\| ADR-0008',decisions,re.M) is not None)
identity=gate.split('## ',2)[1] if '## ' in gate else ''
check('current report identity no stale pending authority','owner decision pending' not in identity.casefold() and 'authoritative state remains IN_PROGRESS' not in identity)
check('known issues and support scopes remain honest','KI-0100 remains MEDIUM/OPEN' in text('docs/KNOWN_ISSUES.md') and 'no production ATS or desktop certification row is added' in text('docs/COMPATIBILITY_MATRIX.md'))
result={'scope':'READ_ONLY_METADATA_GOVERNANCE_NO_ACTORS_NO_TEST_RUNS','reviewer':'/root/delegated_acceptance_audit','base_commit':BASE,'result':'CLEAR' if all(c['pass'] for c in checks) else 'FIX_DOCUMENTARY_FINDINGS','checks':checks,'actual_check_count':len(checks),'passed':sum(c['pass'] for c in checks),'errors':[c for c in checks if not c['pass']],'retained_reader_history':'An initial read-only print probe assumed outer CI manifest members was a list; it is an integer490. TypeError produced no mutations/actors and this reader uses the actual schema.'}
(OUT/'findings.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'result':result['result'],'passed':result['passed'],'checks':len(checks),'errors':result['errors']},indent=2))
