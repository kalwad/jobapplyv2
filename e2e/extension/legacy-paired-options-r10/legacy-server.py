"""Disclosed isolated wrapper; unchanged legacy router, raw facts from frozen paired inputs."""
import hashlib
import importlib.util
import json
import os
import platform
from importlib.metadata import version
from pathlib import Path

HERE = Path(__file__).resolve().parent
# R10 preparation has no current candidate pin and cannot start a server.
readiness = json.loads((HERE / 'r10-readiness.json').read_text())
if readiness.get('state') != 'SOURCE_BOUND_REVIEWED':
    raise RuntimeError('R10_SOURCE_ONLY_FUTURE_CANDIDATE_UNBOUND')
# Only the reviewed coordinator supplies this exact out-of-band full-PASS release.
release_path = Path(os.environ.get('JAPP_R10_RELEASE_DESCRIPTOR', ''))
release_commitment = os.environ.get('JAPP_R10_RELEASE_DESCRIPTOR_SHA256')
if not release_path.is_absolute() or not release_path.is_file() or release_path.is_symlink():
    raise RuntimeError('R10_EXACT_OUT_OF_BAND_FULL_PASS_RELEASE_REQUIRED')
release_bytes = release_path.read_bytes()
if 'sha256:' + hashlib.sha256(release_bytes).hexdigest() != release_commitment:
    raise RuntimeError('R10_RELEASE_DESCRIPTOR_COMMITMENT_DRIFT')
release = json.loads(release_bytes)
if release.get('state') != 'FROZEN_REVIEWED_AFTER_EXACT_FULL_PASS' or not release.get('candidate_commit') or not release.get('full_completion_sha256') or release.get('runtime_inventory_digest') != readiness.get('candidate_runtime_inventory_digest'):
    raise RuntimeError('R10_FUTURE_FULL_PASS_RELEASE_PINS_INCOMPLETE')
if os.environ.get('JAPP_W14_PAIRED_OPTIONS_EVALUATION') != '1':
    raise RuntimeError('PAIRED_OPTIONS_EXPLICIT_OPT_IN_REQUIRED')
RUNTIME_NONCE = os.environ.get('JAPP_W14_PAIRED_RUNTIME_NONCE', '')
if len(RUNTIME_NONCE) != 36 or any(c not in '0123456789abcdef-' for c in RUNTIME_NONCE):
    raise RuntimeError('PAIRED_OPTIONS_OWNED_SERVER_NONCE_REQUIRED')
LEGACY = Path(os.environ['JAPP_W14_PAIRED_LEGACY_ROOT'])
if not LEGACY.is_absolute():
    raise RuntimeError('PAIRED_OPTIONS_ABSOLUTE_LEGACY_ROOT_REQUIRED')
def sha(data):
    return 'sha256:' + hashlib.sha256(data).hexdigest()
def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
def read(name):
    return json.loads((HERE / name).read_text())
lock_bytes = (HERE / 'campaign.lock.json').read_bytes()
LOCK = sha(lock_bytes)
if os.environ.get('JAPP_W14_PAIRED_EXPECTED_LOCK') != LOCK:
    raise RuntimeError('PAIRED_OPTIONS_LOCK_COMMITMENT_REQUIRED_OR_DRIFTED')
lock = json.loads(lock_bytes)
if lock['format_version'] != 'W14_PAIRED_OPTIONS_CAMPAIGN_LOCK_1':
    raise RuntimeError('PAIRED_OPTIONS_LOCK_FORMAT_REFUSED')
for file in lock['files']:
    path = Path(file['path'])
    if path.is_absolute() or '..' in path.parts or sha((HERE / path).read_bytes()) != file['sha256']:
        raise RuntimeError('PAIRED_OPTIONS_FROZEN_SOURCE_DRIFT')
bindings = read('source-bindings.json')
for source in bindings['legacy_sources']:
    if sha((LEGACY / source['path']).read_bytes()) != source['sha256']:
        raise RuntimeError('PAIRED_OPTIONS_LEGACY_SOURCE_DRIFT')
inputs = read('paired-inputs.json')
originals = read('preimages/evaluation-inputs.json')
projections = read('legacy-projections.json')
original_profile = read('preimages/evaluation-profile.json')
if not len(inputs) == len(projections) == len(originals) == 4:
    raise RuntimeError('PAIRED_OPTIONS_INVENTORY_REFUSED')
for entry, prior, projection, bound in zip(inputs, originals, projections, bindings['cases'], strict=True):
    facts = entry['input']['profile']
    if entry['case_id'] != bound['case_id'] or entry['case_id'] == prior['case_id'] or entry['fixture_id'] != prior['fixture_id'] or entry['input']['html'] != prior['input']['html'] or sha(canonical(entry['input']).encode()) != bound['input_digest'] or set(entry['input']) != {'html', 'profile'} or len(facts) != 10:
        raise RuntimeError('PAIRED_OPTIONS_INPUT_DRIFT')
    for fact, old in zip(facts, prior['input']['profile'], strict=True):
        token = {'ADDRESS_COUNTRY': 'United States', 'ADDRESS_REGION': 'Michigan'}.get(fact['concept'])
        if fact['concept'] != old['concept'] or fact['value'] != old['value'] or fact.get('valueToken') != token or set(fact) != ({'concept', 'value', 'valueToken'} if token is not None else {'concept', 'value'}):
            raise RuntimeError('PAIRED_OPTIONS_NONDECLARED_FACT_DELTA')
    values = {fact['concept']: fact['value'] for fact in facts}
    if len(values) != 10:
        raise RuntimeError('PAIRED_OPTIONS_DUPLICATE_FACT')
    profile = {
        'full_name': values['FIRST_NAME'] + ' ' + values['LAST_NAME'],
        'email': values['EMAIL_ADDRESS'], 'phone': values['PHONE_NUMBER'],
        'website_url': values['WEBSITE_URL'], 'address_street1': values['ADDRESS_LINE_1'],
        'address_city': values['ADDRESS_CITY'], 'address_state': values['ADDRESS_REGION'],
        'address_zip': values['ADDRESS_POSTAL_CODE'], 'address_country_name': values['ADDRESS_COUNTRY'],
    }
    expected_projection = {'case_id': entry['case_id'], 'input_digest': bound['input_digest'], 'profile': profile,
        'unsupported_metadata': [{'concept': fact['concept'], 'valueToken': fact['valueToken'], 'handling': 'OMITTED_BY_LEGACY_PROFILE_ADAPTER_UNSUPPORTED_METADATA'} for fact in facts if 'valueToken' in fact],
        'added_default_facts': []}
    if profile != original_profile or expected_projection != projection:
        raise RuntimeError('PAIRED_OPTIONS_PROFILE_PROJECTION_DRIFT')
profile = projections[0]['profile']
# Runtime metadata is checked and recorded before any browser can be launched.
expected_runtime = dict(line.strip().split('==', 1) for line in (HERE / 'preimages/evaluation-runtime.freeze.txt').read_text().splitlines() if line.strip())
actual_runtime = {name: version(name) for name in expected_runtime}
if platform.python_version() != '3.12.13' or actual_runtime != expected_runtime:
    raise RuntimeError('PAIRED_OPTIONS_PINNED_PYTHON_RUNTIME_REQUIRED')
runtime_metadata = {'python': platform.python_version(), 'implementation': platform.python_implementation(), 'machine': platform.machine(), 'packages': actual_runtime}
# Dependencies and the actual router are loaded only after frozen-source checks.
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
spec = importlib.util.spec_from_file_location('isolated_legacy_autofill', LEGACY / 'app/routers/autofill.py')
legacy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(legacy)
class SyntheticProfile:
    async def get_full_profile(self):
        return profile
    async def get_custom_qa(self):
        return []
app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])
app.state.db = SyntheticProfile()
app.state.ai_client = None
app.include_router(legacy.router)
@app.get('/api/profile/full')
async def full_profile():
    return profile
@app.get('/api/custom-qa')
async def custom_qa():
    return []
@app.get('/api/jobs/lookup')
async def lookup():
    return {'id': None}
@app.get('/api/health')
async def health():
    return {'mode': 'COMPONENT_DETERMINISTIC_NO_AI_PAIRED_OPTIONS'}
@app.get('/evaluation/binding')
async def evaluation_binding():
    return {'runtime': runtime_metadata, 'runtime_nonce': RUNTIME_NONCE, 'campaign_lock_digest': LOCK, 'input_digests': [case['input_digest'] for case in bindings['cases']], 'legacy_projections': projections}
@app.get('/fixture/{index}', response_class=HTMLResponse)
async def fixture(index: int):
    if index < 0 or index >= 4:
        raise HTTPException(status_code=404)
    return '<!doctype html><html><head><meta charset=utf-8></head><body>' + inputs[index]['input']['html'] + '</body></html>'
if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='127.0.0.1', port=18886, log_level='warning')
