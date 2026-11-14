import { XML } from 'expo/config-plugins';

const plugin = require('../plugins/withHardenedAndroid') as {
  hardenManifest: (m: unknown, o?: { keepNetwork?: boolean }) => Manifest;
  NETWORK_PERMISSIONS: string[];
  DATA_EXTRACTION_RULES: string;
  FULL_BACKUP_CONTENT: string;
};

type Attrs = Record<string, string>;
type Manifest = {
  manifest: {
    $: Attrs;
    'uses-permission'?: { $: Attrs }[];
    application: { $: Attrs }[];
  };
};

const TEMPLATE = `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.INTERNET"/>
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
  <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW"/>
  <uses-permission android:name="android.permission.VIBRATE"/>
  <uses-permission android:name="android.permission.USE_BIOMETRIC"/>
  <application android:name=".MainApplication" android:allowBackup="true" tools:replace="android:icon">
    <activity android:name=".MainActivity"/>
  </application>
</manifest>`;

async function harden(keepNetwork = false): Promise<Manifest> {
  const parsed = (await XML.parseXMLAsync(TEMPLATE)) as unknown as Manifest;
  return plugin.hardenManifest(parsed, { keepNetwork });
}

const perms = (m: Manifest) => m.manifest['uses-permission'] ?? [];
const removed = (m: Manifest) => perms(m).filter((p) => p.$['tools:node'] === 'remove').map((p) => p.$['android:name']);
const kept = (m: Manifest) => perms(m).filter((p) => p.$['tools:node'] !== 'remove').map((p) => p.$['android:name']);

describe('withHardenedAndroid', () => {
  it('strips every network permission in release builds, including library ones', async () => {
    const m = await harden();
    expect(removed(m).sort()).toEqual([...plugin.NETWORK_PERMISSIONS].sort());
    expect(kept(m)).not.toContain('android.permission.INTERNET');
    expect(kept(m)).not.toContain('android.permission.ACCESS_NETWORK_STATE');
    expect(m.manifest.$['xmlns:tools']).toBe('http://schemas.android.com/tools');
  });

  it('keeps unrelated permissions', async () => {
    expect(kept(await harden())).toEqual(
      expect.arrayContaining(['android.permission.VIBRATE', 'android.permission.USE_BIOMETRIC']),
    );
  });

  it('keeps only INTERNET for dev builds', async () => {
    const m = await harden(true);
    expect(kept(m)).toContain('android.permission.INTERNET');
    expect(removed(m)).not.toContain('android.permission.INTERNET');
    expect(removed(m)).toContain('android.permission.ACCESS_NETWORK_STATE');
  });

  it('disables backup, device transfer and cleartext, overriding libraries', async () => {
    const app = (await harden()).manifest.application[0].$;
    expect(app['android:allowBackup']).toBe('false');
    expect(app['android:usesCleartextTraffic']).toBe('false');
    expect(app['android:fullBackupContent']).toBe('@xml/vault_full_backup_content');
    expect(app['android:dataExtractionRules']).toBe('@xml/vault_data_extraction_rules');
    expect(app['tools:replace'].split(',').sort()).toEqual(
      ['android:allowBackup', 'android:dataExtractionRules', 'android:fullBackupContent', 'android:icon'].sort(),
    );
  });

  it('is idempotent', async () => {
    const once = await harden();
    const twice = plugin.hardenManifest(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });

  it.each(['root', 'file', 'database', 'sharedpref', 'external'])('excludes the %s domain from every backup path', (domain) => {
    const rule = `<exclude domain="${domain}" path="." />`;
    expect(plugin.FULL_BACKUP_CONTENT).toContain(rule);
    const [cloud, transfer] = plugin.DATA_EXTRACTION_RULES.split('<device-transfer>');
    expect(cloud).toContain(rule);
    expect(transfer).toContain(rule);
  });
});
