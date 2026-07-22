/**
 * Report a problem (P4-T15) — the in-app "what broke" surface. A stranger who hits a
 * bug needs a two-tap way to tell us, or they just uninstall. This composes a short
 * report (their note + app version + the last caught crash, if any) and hands it to
 * the OS share sheet — no server, no account, nothing sent without an explicit tap.
 */
import { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Share, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { getSetting } from '@sabd/storage';

import { useTheme } from '../src/theme';
import { getStorage } from '../src/storage/db';

interface Crash {
  message: string;
  at: number;
}

export default function Feedback() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);

  const lastCrash = useMemo<Crash | null>(() => {
    if (Platform.OS === 'web') return null;
    try {
      return getSetting<Crash | null>(getStorage().db, 'lastCrash', null);
    } catch {
      return null;
    }
  }, []);

  const version = Constants.expoConfig?.version ?? 'dev';

  const send = useCallback(async () => {
    const body =
      `Sabd feedback\n` +
      `app v${version} · ${Platform.OS}\n\n` +
      `${note.trim() || '(no description)'}\n` +
      (lastCrash ? `\n— last crash —\n${lastCrash.message}\n` : '');
    try {
      await Share.share({ message: body });
      setSent(true);
    } catch {
      // User dismissed the share sheet — not an error worth surfacing.
    }
  }, [note, lastCrash, version]);

  return (
    <View style={[styles.screen, { backgroundColor: t.colors.ink, paddingTop: insets.top + 20 }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Text style={{ fontFamily: t.font.mono, fontSize: 20, color: t.colors.paperDim }}>←</Text>
        </Pressable>
        <Text style={{ fontFamily: t.font.brand, fontSize: 22, letterSpacing: 1, color: t.colors.paper }}>REPORT</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={{ fontFamily: t.font.body, fontSize: 14, lineHeight: 21, color: t.colors.paperDim }}>
          Something feel off? Tell us what broke. We read every one — it’s how the game gets
          better. Only your note{lastCrash ? ' and the last error' : ''} is included.
        </Text>

        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          placeholder="What happened?"
          placeholderTextColor={t.colors.paperDim}
          accessibilityLabel="Describe the problem"
          style={[styles.input, { color: t.colors.paper, borderColor: t.colors.railTrack, backgroundColor: t.colors.ink2 }]}
        />

        {lastCrash && (
          <Text style={{ fontFamily: t.font.mono, fontSize: 11, color: t.colors.paperDim, marginTop: 12 }}>
            A recent crash will be attached: “{lastCrash.message.slice(0, 80)}”
          </Text>
        )}

        <Pressable
          accessibilityRole="button"
          onPress={send}
          style={[styles.button, { backgroundColor: t.colors.kesar }]}
        >
          <Text style={{ fontFamily: t.font.brand, fontSize: 16, letterSpacing: 1, color: t.colors.ink }}>SEND REPORT</Text>
        </Pressable>

        {sent && (
          <Text accessibilityLiveRegion="polite" style={{ fontFamily: t.font.body, fontSize: 14, color: t.colors.confirm, marginTop: 16, textAlign: 'center' }}>
            Thank you — this genuinely helps.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 8 },
  back: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  body: { paddingHorizontal: 24, paddingTop: 8 },
  input: {
    borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 20, minHeight: 130,
    fontFamily: 'InstrumentSans_400Regular', fontSize: 15, lineHeight: 22, textAlignVertical: 'top',
  },
  button: { borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 22 },
});
