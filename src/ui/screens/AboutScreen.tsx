import Constants from 'expo-constants';
import React from 'react';
import { Text, View } from 'react-native';
import { useApp } from '../AppContext';
import { Card, Overline, Screen } from '../components/ui';
import { font, type, useTheme } from '../theme';

const VERSION = Constants.expoConfig?.version ?? '';

const PROTECTION = [
  'Passwords are encrypted and saved only on this phone.',
  'The app never connects to the internet.',
  'It opens with your PIN, or your fingerprint or face if you turn that on.',
  'It locks when you leave the app or stop using it.',
  'Backups are files you make yourself, locked with a password you choose.',
];

export function AboutScreen() {
  const { back } = useApp();
  const t = useTheme();
  return (
    <Screen testID="about-screen" onBack={back} title="App">
      <Card>
        <Text style={[type.heading, { color: t.ink }]}>Keystill</Text>
        <Text style={[type.body, { color: t.ink2 }]}>A password manager that works offline. No account, no cloud.</Text>
      </Card>

      <View style={{ gap: 10, marginTop: 6 }}>
        <Overline style={{ paddingLeft: 4 }}>Details</Overline>
        <Card padded={false}>
          <Row label="Version" value={VERSION} />
          <Sep />
          <Row label="Made by" value="Indrajith P" />
          <Sep />
          <Row label="License" value="MIT" />
        </Card>
      </View>

      <View style={{ gap: 10, marginTop: 6 }}>
        <Overline style={{ paddingLeft: 4 }}>How your vault is protected</Overline>
        <Card style={{ gap: 10 }}>
          {PROTECTION.map((line) => (
            <View key={line} style={{ flexDirection: 'row', gap: 10 }}>
              <Text style={[type.body, { color: t.muted }]}>•</Text>
              <Text style={[type.body, { flex: 1, color: t.ink }]}>{line}</Text>
            </View>
          ))}
        </Card>
      </View>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 50, paddingHorizontal: 16, gap: 12 }}>
      <Text style={[type.body, { flex: 1, color: t.ink2 }]}>{label}</Text>
      <Text style={{ fontFamily: font.semibold, fontSize: 14, color: t.ink }}>{value}</Text>
    </View>
  );
}

function Sep() {
  const t = useTheme();
  return <View style={{ height: 1, backgroundColor: t.divider, marginLeft: 16 }} />;
}
