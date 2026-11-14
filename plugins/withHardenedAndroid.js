const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('expo/config-plugins');

const NETWORK_PERMISSIONS = [
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.ACCESS_WIFI_STATE',
  'android.permission.CHANGE_NETWORK_STATE',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.SYSTEM_ALERT_WINDOW',
];

const DATA_EXTRACTION_RULES = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup>
    <exclude domain="root" path="." />
    <exclude domain="file" path="." />
    <exclude domain="database" path="." />
    <exclude domain="sharedpref" path="." />
    <exclude domain="external" path="." />
  </cloud-backup>
  <device-transfer>
    <exclude domain="root" path="." />
    <exclude domain="file" path="." />
    <exclude domain="database" path="." />
    <exclude domain="sharedpref" path="." />
    <exclude domain="external" path="." />
  </device-transfer>
</data-extraction-rules>
`;

const FULL_BACKUP_CONTENT = `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
  <exclude domain="root" path="." />
  <exclude domain="file" path="." />
  <exclude domain="database" path="." />
  <exclude domain="sharedpref" path="." />
  <exclude domain="external" path="." />
</full-backup-content>
`;

function hardenManifest(androidManifest, { keepNetwork = false } = {}) {
  const manifest = androidManifest.manifest;
  manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

  const blocked = keepNetwork
    ? NETWORK_PERMISSIONS.filter((p) => p !== 'android.permission.INTERNET')
    : NETWORK_PERMISSIONS;

  const existing = (manifest['uses-permission'] || []).filter(
    (p) => !blocked.includes(p.$['android:name']),
  );
  manifest['uses-permission'] = [
    ...existing,
    ...blocked.map((name) => ({ $: { 'android:name': name, 'tools:node': 'remove' } })),
  ];

  const app = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
  app.$['android:allowBackup'] = 'false';
  app.$['android:fullBackupContent'] = '@xml/vault_full_backup_content';
  app.$['android:dataExtractionRules'] = '@xml/vault_data_extraction_rules';
  app.$['android:usesCleartextTraffic'] = 'false';
  const toolsReplace = new Set((app.$['tools:replace'] || '').split(',').filter(Boolean));
  ['android:allowBackup', 'android:fullBackupContent', 'android:dataExtractionRules'].forEach((a) =>
    toolsReplace.add(a),
  );
  app.$['tools:replace'] = [...toolsReplace].join(',');
  return androidManifest;
}

function withManifestHardening(config) {
  return withAndroidManifest(config, (cfg) => {
    hardenManifest(cfg.modResults, { keepNetwork: process.env.VAULT_DEV_NETWORK === '1' });
    return cfg;
  });
}

function withBackupRuleFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const xmlDir = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(path.join(xmlDir, 'vault_data_extraction_rules.xml'), DATA_EXTRACTION_RULES);
      fs.writeFileSync(path.join(xmlDir, 'vault_full_backup_content.xml'), FULL_BACKUP_CONTENT);
      return cfg;
    },
  ]);
}

function withHardenedAndroid(config) {
  return withBackupRuleFiles(withManifestHardening(config));
}

module.exports = withHardenedAndroid;
module.exports.hardenManifest = hardenManifest;
module.exports.NETWORK_PERMISSIONS = NETWORK_PERMISSIONS;
module.exports.DATA_EXTRACTION_RULES = DATA_EXTRACTION_RULES;
module.exports.FULL_BACKUP_CONTENT = FULL_BACKUP_CONTENT;
