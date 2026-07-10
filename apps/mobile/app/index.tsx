/**
 * Home — PLACEHOLDER (T8 scaffold check).
 *
 * The real Home (locked mockup 8b: topic grid, glowing rating, PLAY) is built in T19.
 * This screen exists to prove the scaffold end-to-end: it renders all four brand faces,
 * pulls values from `@sabd/tokens` via the ThemeProvider, shows the RN-safe topic accent,
 * and reads the loaded word bank + engine so the workspace wiring is exercised at runtime.
 */
import { View, Text, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { size as wordBankSize, wordBankVersion } from '@sabd/wordbank';
import { defaultConfig } from '@sabd/elo';

import { useTheme } from '../src/theme';

export default function Home() {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { backgroundColor: t.colors.ink, paddingTop: insets.top + 24 }]}>
      {/* Wordmark lockup: rail ABOVE the word (never through it). */}
      <View style={styles.lockup}>
        <View style={[styles.rail, { backgroundColor: t.colors.kesar }]} />
        <Text style={[styles.wordmark, { color: t.colors.paper, fontFamily: t.font.brand }]}>SABD</Text>
      </View>

      {/* Rating ◆ — Martian Mono, tabular. */}
      <Text style={[styles.rating, { color: t.colors.kesar, fontFamily: t.font.monoBold }]}>◆ 1000</Text>

      {/* Topic label — Archivo, in the current topic accent. */}
      <Text style={[styles.topic, { color: t.accent(), fontFamily: t.font.display }]}>GAMING</Text>

      {/* Body voice — Instrument Sans. */}
      <Text style={[styles.body, { color: t.colors.paperDim, fontFamily: t.font.body }]}>
        Scaffold check — the real Home ships in T19.
      </Text>

      <Text style={[styles.meta, { color: t.colors.paperDim, fontFamily: t.font.mono }]}>
        wordbank v{wordBankVersion} · {wordBankSize} words · K{defaultConfig.kProvisional}
      </Text>

      {/* Dev harness for the round components (T12–T14). Removed when Home ships (T19). */}
      <Link href="/round-demo" style={[styles.link, { color: t.accent(), fontFamily: t.font.monoMedium }]}>
        ▶ round components demo
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', paddingHorizontal: 24, gap: 20 },
  lockup: { alignItems: 'center', gap: 6, marginTop: 40 },
  rail: { height: 3, width: 128, borderRadius: 2 },
  wordmark: { fontSize: 48, letterSpacing: 2 },
  rating: { fontSize: 22, letterSpacing: 1 },
  topic: { fontSize: 20, letterSpacing: 1 },
  body: { fontSize: 15, textAlign: 'center' },
  meta: { fontSize: 12, letterSpacing: 0.5, marginTop: 8 },
  link: { fontSize: 13, letterSpacing: 0.5, marginTop: 24 },
});
