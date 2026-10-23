#!/usr/bin/env node
// Sync the App Store listing in store.config.json to App Store Connect.
//
//   node scripts/asc-listing.mjs           diff config vs. App Store Connect (read-only)
//   node scripts/asc-listing.mjs --push    write it
//
// Apple only lets name, subtitle, keywords and description change on a version
// that's still being prepared. Promotional text can change on the live version.
// So --push writes everything to the editable version if one exists, and only
// promo text to the live one. Auth reuses the ASC API key from eas.json.
import crypto from 'node:crypto';
import fs from 'node:fs';

const root = new URL('..', import.meta.url);
const eas = JSON.parse(fs.readFileSync(new URL('eas.json', root)));
const { ascApiKeyPath, ascApiKeyId, ascApiKeyIssuerId, ascAppId } = eas.submit.production.ios;
const listing = JSON.parse(fs.readFileSync(new URL('store.config.json', root))).apple.info;
const push = process.argv.includes('--push');

const LIVE = ['READY_FOR_SALE'];
const EDITABLE = [
  'PREPARE_FOR_SUBMISSION',
  'DEVELOPER_REJECTED',
  'REJECTED',
  'METADATA_REJECTED',
  'INVALID_BINARY',
];

function token() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: 'ES256', kid: ascApiKeyId, typ: 'JWT' })}.${b64({
    iss: ascApiKeyIssuerId,
    iat: now,
    exp: now + 1100,
    aud: 'appstoreconnect-v1',
  })}`;
  const key = fs.readFileSync(ascApiKeyPath, 'utf8');
  const sig = crypto.sign('sha256', Buffer.from(unsigned), { key, dsaEncoding: 'ieee-p1363' });
  return `${unsigned}.${sig.toString('base64url')}`;
}

const auth = `Bearer ${token()}`;
async function api(path, init = {}) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    ...init,
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status}\n${text}`);
  return text ? JSON.parse(text) : null;
}

// config field → ASC attribute, for each localization resource.
const INFO_FIELDS = { title: 'name', subtitle: 'subtitle', privacyPolicyUrl: 'privacyPolicyUrl' };
const VERSION_FIELDS = {
  keywords: 'keywords',
  description: 'description',
  promoText: 'promotionalText',
  supportUrl: 'supportUrl',
};

const wanted = (cfg, field) => (field === 'keywords' ? cfg.keywords.join(',') : cfg[field]);

async function sync(label, localizationsPath, type, fields) {
  const { data } = await api(localizationsPath);
  for (const loc of data) {
    const cfg = listing[loc.attributes.locale];
    if (!cfg) continue;
    const changes = {};
    for (const [field, attr] of Object.entries(fields)) {
      const want = wanted(cfg, field);
      if (want !== undefined && want !== loc.attributes[attr]) changes[attr] = want;
    }
    const keys = Object.keys(changes);
    console.log(`${label} [${loc.attributes.locale}] ${keys.length ? keys.join(', ') : 'up to date'}`);
    for (const k of keys) console.log(`  ${k}: ${JSON.stringify(loc.attributes[k])}\n  ${' '.repeat(k.length)}→ ${JSON.stringify(changes[k])}`);
    if (push && keys.length) {
      await api(`/v1/${type}/${loc.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ data: { type, id: loc.id, attributes: changes } }),
      });
      console.log('  ✓ pushed');
    }
  }
}

const infos = (await api(`/v1/apps/${ascAppId}/appInfos`)).data;
const versions = (await api(`/v1/apps/${ascAppId}/appStoreVersions?filter[platform]=IOS&limit=10`)).data;
const stateOf = (r) => r.attributes.appStoreState ?? r.attributes.state;
const editableInfo = infos.find((i) => EDITABLE.includes(stateOf(i)));
const editableVersion = versions.find((v) => EDITABLE.includes(stateOf(v)));
const liveVersion = versions.find((v) => LIVE.includes(stateOf(v)));

if (editableVersion) {
  const label = `v${editableVersion.attributes.versionString} (${stateOf(editableVersion)})`;
  if (editableInfo) {
    await sync(`${label} app info`, `/v1/appInfos/${editableInfo.id}/appInfoLocalizations`, 'appInfoLocalizations', INFO_FIELDS);
  }
  await sync(label, `/v1/appStoreVersions/${editableVersion.id}/appStoreVersionLocalizations`, 'appStoreVersionLocalizations', VERSION_FIELDS);
} else {
  console.log('No editable version. Create one in App Store Connect to change name/subtitle/keywords/description.');
}
if (liveVersion) {
  await sync(
    `v${liveVersion.attributes.versionString} live`,
    `/v1/appStoreVersions/${liveVersion.id}/appStoreVersionLocalizations`,
    'appStoreVersionLocalizations',
    { promoText: 'promotionalText' },
  );
}
if (!push) console.log('\nDry run. Re-run with --push to write.');
