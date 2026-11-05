"""Independent finite documentary audit. No subject code is imported or executed."""
import base64, hashlib, io, json, pathlib, re, shlex, stat, subprocess, tarfile, zipfile

P = pathlib.Path('/tmp/japp-m03-w03-hosted-ci-6d3a6b8-20261019')
O = pathlib.Path(__file__).parent
A = pathlib.Path(str(P) + '-retained/proof.tar.gz')
HEAD = '6d3a6b8ccde5b75e12248ae7bbefc473b72922e4'
TREE = '34fcf854cb4a1a452b267a02a05e0c34aeb6f89c'
MERGE = '0d3f8dfa4c9c9acd3dbe784e3b3ef6f4a944677c'

def sha(b): return hashlib.sha256(b).hexdigest()
def load(n): return json.loads((P / n).read_bytes())
def safe(n):
    q = pathlib.PurePosixPath(n)
    return bool(n) and not q.is_absolute() and '..' not in q.parts and '\\' not in n and '\x00' not in n
def bound(b, row):
    assert len(b) == row['bytes'] and sha(b) == row['sha256'], row

manifest = load('evidence-inputs.json')
assert sha((P / 'evidence-inputs.json').read_bytes()) == 'e8754bca1d6f2f1e1c7358fab7446b08109ee57361df8f92ac190bb9ed1fa9bd'
assert len(manifest['files']) == manifest['file_count'] == 478
expected = {x['path']: x for x in manifest['files']}
assert len(expected) == 478
archive = A.read_bytes()
assert len(archive) == 5781496 and sha(archive) == '637cb8795b5b158794410b20b5d31e27d88deea9941edbac8ae4203aded5cdff'
with tarfile.open(fileobj=io.BytesIO(archive), mode='r:gz') as t:
    members = t.getmembers()
    assert len(members) == 479 and all(x.isfile() and safe(x.name) for x in members)
    assert len({x.name.casefold() for x in members}) == 479
    assert set(x.name for x in members) == set(expected) | {'evidence-inputs.json'}
    for m in members:
        data = t.extractfile(m).read()
        assert data == (P / m.name).read_bytes(), m.name
        if m.name in expected: bound(data, expected[m.name])

records = []
for folder in ('commands', 'operations'):
    for q in sorted((P / folder).glob('*.record.json')):
        d = json.loads(q.read_bytes())
        for key in ('stdout', 'stderr'):
            item = d[key]
            assert safe(item['path'])
            bound((P / item['path']).read_bytes(), item)
        records.append({'path': str(q.relative_to(P)), 'exit_code': d['exit_code'], 'timeout': d.get('collector_command_timeout', False)})

zmanifest = load('official-logs-manifest.json')
rawzip = (P / 'logs.zip').read_bytes()
bound(rawzip, zmanifest['zip'])
assert rawzip == (P / zmanifest['zip']['command_stdout']).read_bytes()
zm = {r['path']: r for r in zmanifest['files']}
with zipfile.ZipFile(io.BytesIO(rawzip)) as z:
    zi = z.infolist()
    assert len(zi) == len(zm) == zmanifest['safe_regular_file_count'] == 86
    assert z.testzip() is None and len({m.filename.casefold() for m in zi}) == 86
    for m in zi:
        assert safe(m.filename) and not m.is_dir() and not stat.S_ISLNK(m.external_attr >> 16)
        b = z.read(m)
        bound(b, zm[m.filename])
        assert format(m.CRC, '08x') == zm[m.filename]['crc32_hex']
        assert b == (P / 'official-logs' / m.filename).read_bytes()

remote = load('commands/0008-expected-recursive-tree.stdout')
assert remote['sha'] == TREE and remote['truncated'] is False
remote_blobs = {r['path']: r for r in remote['tree'] if r['type'] == 'blob'}
candidate = load('candidate-working-source-binding.json')
parent = load('parent-candidate/candidate-source-manifest.json')
assert candidate['head_sha'] == HEAD and candidate['tree_sha'] == TREE
assert len(candidate['files']) == len(remote_blobs) == len(parent) == 1798
git = ['/usr/bin/git', '-C', '/Users/tanishkalwad/jobapplyv2']
tree = subprocess.check_output(git + ['rev-parse', HEAD + '^{tree}']).decode().strip()
assert tree == TREE
git_tree = subprocess.check_output(git + ['ls-tree', '-rz', '--full-tree', HEAD])
assert git_tree == (P / 'commands/0009-candidate-exact-git-ls-tree.stdout').read_bytes()
local_entries = {}
for row in git_tree.split(b'\x00'):
    if not row: continue
    attrs, name = row.split(b'\t', 1)
    mode, kind, blob = attrs.decode().split()
    local_entries[name.decode()] = (mode, kind, blob)
assert set(local_entries) == set(remote_blobs)
for n, row in remote_blobs.items():
    assert local_entries[n] == (row['mode'], row['type'], row['sha'])
rows = candidate['files']
batch = subprocess.run(git + ['cat-file', '--batch'], input=('\n'.join(r['git_blob_sha'] for r in rows) + '\n').encode(), stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
stream = io.BytesIO(batch.stdout)
candidate_dir = pathlib.Path(candidate['candidate_path'])
for r in rows:
    blob, kind, size = stream.readline().decode().strip().split()
    b = stream.read(int(size)); assert stream.read(1) == b'\n'
    assert blob == r['git_blob_sha'] == remote_blobs[r['path']]['sha'] and kind == 'blob'
    bound(b, r)
    assert parent[r['path']] == {'bytes': len(b), 'sha256': sha(b)}
    assert (candidate_dir / r['path']).read_bytes() == b
assert stream.read() == b''
selected = load('selected-source-manifest.json')['files'] + load('failure-source-manifest.json')['files']
for r in selected:
    b = (P / 'source' / r['path']).read_bytes(); bound(b, r)
    assert hashlib.sha1(('blob ' + str(len(b)) + '\x00').encode() + b).hexdigest() == r['git_blob_sha'] == remote_blobs[r['path']]['sha']
    api = load(r['record_stdout'])
    assert api['sha'] == r['git_blob_sha'] and base64.b64decode(api['content']) == b

summary = load('hosted-ci-summary.json')
registry = json.loads((P / 'source/scripts/verification-suites.json').read_bytes())
suite_ids = [s['id'] for s in registry['suites']]
assert suite_ids == summary['registry_suite_ids'] and len(suite_ids) == 20
assert summary['run_id'] == 39188122249 and summary['head_sha'] == HEAD and summary['expected_source_tree'] == TREE
assert summary['all_three_hosts_pass'] is False and summary['run_conclusion'] == 'failure'
logs = {h['label']: (P / h['platform_log']).read_text().splitlines() for h in summary['platforms']}
evidence_count = [0]
def evidence_check(value):
    if isinstance(value, dict):
        if {'log', 'line', 'raw'}.issubset(value):
            lines = (P / value['log']).read_text().splitlines()
            assert lines[value['line'] - 1] == value['raw']
            if 'text' in value: assert value['text'] in value['raw']
            evidence_count[0] += 1
        for v in value.values(): evidence_check(v)
    elif isinstance(value, list):
        for v in value: evidence_check(v)
evidence_check(summary)

results = []
expected_counts = {'ubuntu-24.04': (1653, 76), 'windows-2025': (1651, 70), 'macos-15': (1653, 77)}
rust_commands = next(s['commands'] for s in registry['suites'] if s['id'] == 'rust')
for h in summary['platforms']:
    label = h['label']; lines = logs[label]
    text = '\n'.join(lines)
    plain = [re.sub(r'^\d{4}-\d\d-\d\dT\S+Z ', '', x) for x in lines]
    observed = []
    for num, line in enumerate(plain, 1):
        m = re.fullmatch(r'(\S+)\s+ACTIVE\s+(PASS|FAIL)(?:\s+.*)?', line)
        if m: observed.append({'id': m.group(1), 'result': m.group(2), 'line': num})
    assert [x['id'] for x in observed] == suite_ids
    assert [x['result'] for x in observed] == [x['result'] for x in h['suite_rows']]
    failed = [x['id'] for x in observed if x['result'] != 'PASS']
    assert failed == (['e2e-browser'] if label == 'windows-2025' else [])
    assert f'verification exit code: {1 if failed else 0}' in plain
    assert 'summary: 28 pass, 0 warning, 0 fail, 0 not-yet-applicable' in plain
    pycount, nativecount = expected_counts[label]
    pys = [(i, x) for i, x in enumerate(plain, 1) if re.fullmatch(r'=+ '+str(pycount)+r' passed in .* =+', x)]
    assert len(pys) == 1
    assert MERGE in text and (P / 'official-logs' / h['official_combined_member']).read_bytes() == (P / h['platform_log']).read_bytes()
    api = load(h['checkout_commit_api']['record_stdout'])
    assert api['sha'] == MERGE and api['tree']['sha'] == TREE
    command_rows = [(i, x) for i, x in enumerate(plain, 1) if x.startswith('$ ')]
    expected_cmds = ['$ ' + shlex.join(c) for c in rust_commands]
    # The source runner prints tokens joined with spaces for this registry (no argument contains spaces).
    expected_cmds = ['$ ' + ' '.join(c) for c in rust_commands]
    actual_rust = [r for r in command_rows if r[1] in expected_cmds and r[0] > pys[0][0]]
    assert [x[1] for x in actual_rust] == expected_cmds and len(actual_rust) == 15
    mode_results = []
    for start, command in actual_rust:
        end = next((i for i, _ in command_rows if i > start), len(lines) + 1)
        block = plain[start:end-1]
        if command.startswith('$ cargo test --locked --manifest-path apps/desktop/src-tauri/Cargo.toml'):
            matches = [x for x in block if re.fullmatch(r'test result: ok\. '+str(nativecount)+r' passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in .+', x)]
            assert len(matches) == 1
            assert sum(x.startswith('test ') and x.endswith(' ... ok') for x in block) == nativecount
            mode_results.append({'command': command, 'passed': nativecount, 'line': start})
        if command.startswith('$ cargo clippy') or command.startswith('$ cargo build --locked --manifest-path apps/desktop/'):
            assert any('Finished `dev` profile' in x for x in block), command
    assert len(mode_results) == 3
    results.append({'platform': label, 'suite_rows': observed, 'doctor_pass': 28, 'python_pass': pycount, 'python_summary_line': pys[0][0], 'native_modes': mode_results, 'rust_commands': len(actual_rust), 'clippy_commands': 3, 'final_native_build_completed': True})

jobs = load('final-jobs.json')['jobs']
assert len(jobs) == 3
for job in jobs:
    label = next(h['label'] for h in summary['platforms'] if h['job_id'] == job['id'])
    step = next(s for s in job['steps'] if s['number'] == 26)
    assert step['conclusion'] == ('skipped' if label == 'windows-2025' else 'success')
    assert job['head_sha'] == HEAD and job['conclusion'] == ('failure' if label == 'windows-2025' else 'success')
listing = load('official-artifacts-list.json')
assert listing['total_count'] == len(listing['artifacts']) == 0
wintext = '\n'.join(logs['windows-2025'])
for token in ['EXTENSION_CONTEXT_CLEANUP_FAILED', 'browserContext.close: Target page, context or browser has been closed', 'EPERM, Permission denied:', 'japp-m02-w07-profile-kUL6PB', '255 passed (13.7m)', 'No files were found with the provided path: test-results/. No artifacts will be uploaded.']:
    assert token in wintext
assert all(p['payload']['samples'] == 1 and p['twenty_sample_target_proof'] is False for h in summary['platforms'] for p in h['extension_benchmark_actual_payloads'])
benchmark = (P / 'source/e2e/extension/extension-benchmark.spec.ts').read_text()
assert 'sampleCount === 20' in benchmark
verifier = (P / 'source/scripts/verify.py').read_text()
assert 'if code != 0:' in verifier
result = {'result': 'PASS_DATA_AND_SOURCE_BINDING_ACTUAL_CI_FAILURE_PRESERVED', 'archive_sha256': sha(archive), 'archive_regular_members': len(members), 'input_rows_checked': len(expected), 'official_zip_regular_members_crc_checked': len(zm), 'all_source_git_remote_candidate_parent_bindings': len(rows), 'selected_api_blobs': len(selected), 'raw_command_operation_records': len(records), 'nonzero_raw_records': [r for r in records if r['exit_code'] != 0 or r['timeout']], 'summary_raw_evidence_references_checked': evidence_count[0], 'platforms': results, 'all_three_hosts_pass': False, 'official_failure_artifacts_available': 0, 'scope': 'Static/data/Git-object inspection only; no subject import, execution, CI/network request, source writes or acceptance.'}
(O / 'findings.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({k: v for k, v in result.items() if k != 'platforms'}, indent=2))
