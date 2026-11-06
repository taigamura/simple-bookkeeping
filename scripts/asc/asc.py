"""Minimal App Store Connect API client (ES256 JWT). Import or run: python3 asc.py GET /v1/apps/ID"""
import base64, json, os, sys, time, urllib.request, urllib.error
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, utils

KEY_PATH = os.path.expanduser('~/.appstoreconnect/keys/AuthKey_FM2QG63KF9.p8')
KID = 'FM2QG63KF9'
ISS = '427cba56-68b8-42ec-b1a8-2f71d5195e53'
APP_ID = '6788700694'
BASE = 'https://api.appstoreconnect.apple.com'

_tok = (0, None)

def _b64(b): return base64.urlsafe_b64encode(b).rstrip(b'=').decode()

def token():
    global _tok
    now = int(time.time())
    if _tok[1] and now < _tok[0] - 60:
        return _tok[1]
    h = _b64(json.dumps({'alg': 'ES256', 'kid': KID, 'typ': 'JWT'}).encode())
    p = _b64(json.dumps({'iss': ISS, 'iat': now, 'exp': now + 1100, 'aud': 'appstoreconnect-v1'}).encode())
    key = serialization.load_pem_private_key(open(KEY_PATH, 'rb').read(), None)
    der = key.sign(f'{h}.{p}'.encode(), ec.ECDSA(hashes.SHA256()))
    r, s = utils.decode_dss_signature(der)
    t = f'{h}.{p}.{_b64(r.to_bytes(32, "big") + s.to_bytes(32, "big"))}'
    _tok = (now + 1100, t)
    return t

class ApiError(Exception):
    pass

def api(method, path, body=None, raw=False, tries=4):
    for i in range(tries):
        try:
            return _api(method, path, body, raw)
        except (urllib.error.URLError, ConnectionError) as e:
            if isinstance(e, urllib.error.HTTPError) or i == tries - 1:
                raise
            time.sleep(2 * (i + 1))

def _api(method, path, body=None, raw=False):
    url = path if path.startswith('http') else BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        'Authorization': 'Bearer ' + token(), 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as res:
            b = res.read()
            if raw:
                return b
            return json.loads(b) if b else None
    except urllib.error.HTTPError as e:
        raise ApiError(f'{method} {path} -> {e.code}\n{e.read().decode()}') from None

def upload_ops(ops, blob):
    """Run the uploadOperations Apple returns for a reserved asset."""
    for op in ops:
        chunk = blob[op['offset']: op['offset'] + op['length']]
        req = urllib.request.Request(op['url'], data=chunk, method=op['method'],
                                     headers={h['name']: h['value'] for h in op.get('requestHeaders', [])})
        with urllib.request.urlopen(req) as res:
            assert res.status in (200, 201, 204), res.status

if __name__ == '__main__':
    m, p = sys.argv[1], sys.argv[2]
    b = json.loads(sys.argv[3]) if len(sys.argv) > 3 else None
    print(json.dumps(api(m, p, b), indent=1, ensure_ascii=False))
