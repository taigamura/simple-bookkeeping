"""Create Suito's In-App Events as drafts (EN + JA), with event card + details images.

    python3 scripts/asc/create_events.py          dry run: validate copy lengths and print
    python3 scripts/asc/create_events.py --push   create on App Store Connect (skips events whose referenceName exists)

Images come from render_event_images.py. Events are NOT submitted for review; add them to the
version's review submission in App Store Connect.
"""
import json, os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
from asc import api, upload_ops, APP_ID

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
IMG = os.path.join(ROOT, 'docs', 'appstore-marketing', 'events')

# All times are midnight JST (UTC+9), the main market.
EVENTS = [
    dict(
        slug='suito-ai', referenceName='Meet Suito AI (1.1.0)', badge='MAJOR_UPDATE',
        purpose='APPROPRIATE_FOR_ALL_USERS', priority='HIGH',
        publishStart='2026-11-13T15:00:00Z', eventStart='2026-11-13T15:00:00Z', eventEnd='2026-12-13T15:00:00Z',
        loc={
            'en-US': dict(name='Meet Suito AI',
                          shortDescription='Say or snap an entry. The AI runs on your iPhone.',
                          longDescription='Say or type an entry in plain words, scan a receipt, ask about your money. On-device AI, needs Apple Intelligence.'),
            'ja': dict(name='新機能「Suito AI」',
                       shortDescription='話すだけ、撮るだけで記録。AIはiPhoneの中で動きます',
                       longDescription='声やことばで入力、レシート読み取り、お金の質問、先月のふりかえり。AIはiPhoneの中で動き、登録も広告もありません。Apple Intelligence対応iPhoneで使えます。'),
        }),
    dict(
        slug='new-year', referenceName='New Year budgeting 2027', badge='CHALLENGE',
        purpose='ATTRACT_NEW_USERS', priority='NORMAL',
        publishStart='2026-12-17T15:00:00Z', eventStart='2026-12-31T15:00:00Z', eventEnd='2027-01-31T14:59:00Z',
        loc={
            'en-US': dict(name='New Year, New Budget',
                          shortDescription='Set a monthly budget and log a little every day.',
                          longDescription='Start 2027 with one monthly budget, or one for each category. Log on a calendar and see what is left this month.'),
            'ja': dict(name='新年から家計簿をはじめよう',
                       shortDescription='予算を決めて、毎日少しずつ記録しよう',
                       longDescription='2027年は月の予算を決めて家計簿をはじめましょう。カレンダーで収入と支出を記録して、今月あといくら使えるかひと目で確認できます。'),
        }),
]
LIMITS = dict(name=30, shortDescription=50, longDescription=120)

def validate():
    ok = True
    for e in EVENTS:
        for lang, l in e['loc'].items():
            for k, n in LIMITS.items():
                bad = len(l[k]) > n or '—' in l[k]
                ok &= not bad
                print(f"{'!!' if bad else 'ok'} {e['slug']} {lang} {k} {len(l[k])}/{n}: {l[k]}")
            for kind in ('card', 'details'):
                assert os.path.exists(os.path.join(IMG, e['slug'], f'{lang}-{kind}.png'))
    return ok

def upload(loc_id, path, asset_type):
    blob = open(path, 'rb').read()
    res = api('POST', '/v1/appEventScreenshots', {'data': {
        'type': 'appEventScreenshots',
        'attributes': {'fileName': os.path.basename(path), 'fileSize': len(blob), 'appEventAssetType': asset_type},
        'relationships': {'appEventLocalization': {'data': {'type': 'appEventLocalizations', 'id': loc_id}}}}})
    sid = res['data']['id']
    upload_ops(res['data']['attributes']['uploadOperations'], blob)
    api('PATCH', f'/v1/appEventScreenshots/{sid}', {'data': {
        'type': 'appEventScreenshots', 'id': sid,
        'attributes': {'uploaded': True}}})
    for _ in range(30):
        st = api('GET', f'/v1/appEventScreenshots/{sid}')['data']['attributes']['assetDeliveryState']
        if st['state'] in ('COMPLETE', 'FAILED'):
            break
        time.sleep(3)
    return sid, st

def push():
    territories = [t['id'] for t in api('GET', '/v1/territories?limit=200')['data']]
    existing = {e['attributes']['referenceName']: e['id'] for e in api('GET', f'/v1/apps/{APP_ID}/appEvents?limit=50')['data']}
    out = []
    for e in EVENTS:
        if e['referenceName'] in existing:  # resume a partial run
            ev = api('GET', f"/v1/appEvents/{existing[e['referenceName']]}")['data']
            print('exists', e['referenceName'], ev['id'])
        else:
          ev = api('POST', '/v1/appEvents', {'data': {
            'type': 'appEvents',
            'attributes': {
                'referenceName': e['referenceName'], 'badge': e['badge'], 'primaryLocale': 'en-US',
                'purpose': e['purpose'], 'priority': e['priority'],
                'territorySchedules': [{'territories': territories, 'publishStart': e['publishStart'],
                                        'eventStart': e['eventStart'], 'eventEnd': e['eventEnd']}]},
            'relationships': {'app': {'data': {'type': 'apps', 'id': APP_ID}}}}})['data']
        rec = dict(slug=e['slug'], id=ev['id'], state=ev['attributes'].get('eventState'), locs={})
        print('event', ev['id'], rec['state'])
        # Apple may auto-create the primary-locale localization; reuse it if so.
        locs = {l['attributes']['locale']: l['id'] for l in api('GET', f"/v1/appEvents/{ev['id']}/localizations")['data']}
        for lang, l in e['loc'].items():
            if lang in locs:
                lid = locs[lang]
                api('PATCH', f'/v1/appEventLocalizations/{lid}', {'data': {
                    'type': 'appEventLocalizations', 'id': lid, 'attributes': l}})
            else:
                lid = api('POST', '/v1/appEventLocalizations', {'data': {
                    'type': 'appEventLocalizations', 'attributes': {'locale': lang, **l},
                    'relationships': {'appEvent': {'data': {'type': 'appEvents', 'id': ev['id']}}}}})['data']['id']
            shots = {}
            have = {}
            for sc in api('GET', f'/v1/appEventLocalizations/{lid}/appEventScreenshots')['data']:
                a = sc['attributes']
                if a['assetDeliveryState']['state'] in ('COMPLETE', 'UPLOAD_COMPLETE'):
                    have[a['appEventAssetType']] = (sc['id'], a['assetDeliveryState'])
                else:  # stale reservation from a failed run
                    api('DELETE', f"/v1/appEventScreenshots/{sc['id']}")
            for kind, at in (('card', 'EVENT_CARD'), ('details', 'EVENT_DETAILS_PAGE')):
                sid, st = have.get(at) or upload(lid, os.path.join(IMG, e['slug'], f'{lang}-{kind}.png'), at)
                shots[at] = dict(id=sid, state=st)
                print(' ', lang, at, sid, json.dumps(st))
            rec['locs'][lang] = dict(id=lid, screenshots=shots)
        out.append(rec)
    print(json.dumps(out, indent=1, ensure_ascii=False))

if __name__ == '__main__':
    if not validate():
        sys.exit('copy over limit')
    if '--push' in sys.argv:
        push()
