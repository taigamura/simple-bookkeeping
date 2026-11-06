"""Create a DRAFT featuring nomination for Suito 1.1.0 (submitted: false).

    python3 scripts/asc/create_nomination.py          print the payload
    python3 scripts/asc/create_nomination.py --push   create it (skips if a nomination with this name exists)

Submit it later in App Store Connect (or PATCH submitted: true) once 1.1.0 is in review.
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from asc import api, APP_ID

NAME = 'Suito 1.1: Suito AI, on-device'
# "Meet Suito AI (1.1.0)" in-app event. Apple rejects linking a DRAFT event (400 PARAMETER_ERROR.INVALID
# on inAppEvents), so leave this empty until the event is approved, then PATCH the relationship in.
EVENT_IDS = []

DESCRIPTION = (
    'Suito 1.1 adds Suito AI to a private, calendar-based expense tracker whose main market is Japan. '
    "Every AI feature runs on-device with Apple's Foundation Models framework. "
    'People say an entry ("昨日 ランチ 850", with on-device speech recognition), type it in plain words, '
    'or scan a receipt, and Suito fills in amount, category, date and note for them to check and save. '
    "Ask answers questions about spending using Suito's own totals, a monthly recap looks back at last month, "
    'and the Calendar shows a month-end forecast. The model never invents numbers: Suito calculates them. '
    'Siri, Shortcuts and Spotlight let people add and find entries from anywhere. '
    'Built natively for iOS 26 with a Liquid Glass tab bar, fully localized in Japanese and English, '
    'with CSV import from Zaim, MoneyForward ME and Okane Reco. '
    'No account, no ads, no in-app purchases, no analytics: nothing leaves the iPhone.'
)
NOTES = (
    'Primary market: Japan (Japanese-first listing and input examples). '
    'Suito AI needs an iPhone that supports Apple Intelligence; on other iPhones the AI features are hidden '
    'and everything else, including Siri and Spotlight, works. Indie app by a solo developer.'
)

def payload(territories):
    return {'data': {
        'type': 'nominations',
        'attributes': {
            'name': NAME, 'type': 'APP_ENHANCEMENTS', 'description': DESCRIPTION, 'notes': NOTES,
            'submitted': False,
            'publishStartDate': '2026-11-13T15:00:00Z',  # 2026-11-14 00:00 JST
            'deviceFamilies': ['IPHONE'], 'locales': ['ja', 'en-US'],
            'hasInAppEvents': True, 'launchInSelectMarketsFirst': False, 'preOrderEnabled': False,
        },
        'relationships': {
            'relatedApps': {'data': [{'type': 'apps', 'id': APP_ID}]},
            **({'inAppEvents': {'data': [{'type': 'appEvents', 'id': i} for i in EVENT_IDS]}} if EVENT_IDS else {}),
            'supportedTerritories': {'data': [{'type': 'territories', 'id': t} for t in territories]},
        }}}

if __name__ == '__main__':
    assert '—' not in DESCRIPTION + NOTES
    print(len(DESCRIPTION), 'chars\n' + DESCRIPTION)
    if '--push' in sys.argv:
        for state in ('DRAFT', 'SUBMITTED'):
            for n in api('GET', f'/v1/nominations?filter[state]={state}&limit=200')['data']:
                if n['attributes']['name'] == NAME:
                    sys.exit(f"exists: {n['id']} {n['attributes']['state']}")
        terr = [t['id'] for t in api('GET', '/v1/territories?limit=200')['data']]
        res = api('POST', '/v1/nominations', payload(terr))['data']
        print(json.dumps({'id': res['id'], **{k: res['attributes'].get(k) for k in ('state', 'type', 'publishStartDate')}}))
