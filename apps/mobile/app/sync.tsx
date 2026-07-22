/**
 * Sync across devices (P4-T9 UI) — the transfer-code claim, wired to the Lane-4 client.
 *
 * Anonymous play stays the default; this is opt-in. Two flows:
 *   · "Link another device" mints a single-use code (requestTransferCode).
 *   · "I have a code" claims an existing history onto this device (claimAccount),
 *     surfacing the designed states — success (restored) or already-claimed (F12).
 *
 * Retro skin to match Settings (this is a utility screen, not the indigo hub).
 */
import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../src/theme';
import { getStorage } from '../src/storage/db';
import { INGEST_BASE_URL } from '../src/sync/config';
import { requestTransferCode, claimAccount, type FetchJson } from '../src/sync/syncClient';

const fetchJson: FetchJson = async (url, init) => {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<unknown>;
};

export default function Sync() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const disabled = Platform.OS === 'web' || INGEST_BASE_URL === null;
  const [code, setCode] = useState<string | null>(null);
  const [entry, setEntry] = useState('');
  const [busy, setBusy] = useState<'get' | 'claim' | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const getCode = useCallback(async () => {
    if (disabled || busy) return;
    setBusy('get');
    setMsg(null);
    try {
      const res = await requestTransferCode(getStorage().db, fetchJson, INGEST_BASE_URL!);
      if (res) setCode(res.code);
      else setMsg({ kind: 'err', text: 'Could not reach the server. Try again when online.' });
    } catch {
      setMsg({ kind: 'err', text: 'Could not reach the server. Try again when online.' });
    } finally {
      setBusy(null);
    }
  }, [disabled, busy]);

  const claim = useCallback(async () => {
    const trimmed = entry.trim().toUpperCase();
    if (disabled || busy || trimmed.length === 0) return;
    setBusy('claim');
    setMsg(null);
    try {
      const res = await claimAccount(getStorage().db, fetchJson, INGEST_BASE_URL!, trimmed, Date.now());
      if (res.ok) {
        setMsg({ kind: 'ok', text: `Restored ${res.restored ?? 0} rounds. Your history is now on this device.` });
        setEntry('');
      } else if (res.reason === 'already_claimed') {
        setMsg({ kind: 'err', text: 'This device already has a history and can’t join another account. Keep playing here, or reach out for help.' });
      } else {
        setMsg({ kind: 'err', text: 'That code isn’t valid — it may have expired or already been used.' });
      }
    } catch {
      setMsg({ kind: 'err', text: 'Could not reach the server. Try again when online.' });
    } finally {
      setBusy(null);
    }
  }, [disabled, busy, entry]);

  return (
    <View style={[styles.screen, { backgroundColor: t.colors.ink, paddingTop: insets.top + 20 }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Text style={{ fontFamily: t.font.mono, fontSize: 20, color: t.colors.paperDim }}>←</Text>
        </Pressable>
        <Text style={{ fontFamily: t.font.brand, fontSize: 22, letterSpacing: 1, color: t.colors.paper }}>SYNC</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={{ fontFamily: t.font.body, fontSize: 14, lineHeight: 21, color: t.colors.paperDim }}>
          Play stays on this device by default. To carry your history to another phone, get a
          code here and enter it there — no account, no password.
        </Text>

        {disabled && (
          <Text style={{ fontFamily: t.font.mono, fontSize: 12, color: t.colors.paperDim, marginTop: 18 }}>
            Sync is available on the phone app.
          </Text>
        )}

        {/* Link another device — mint a code */}
        <Text style={[styles.sectionTitle, { color: t.colors.paperDim }]}>LINK ANOTHER DEVICE</Text>
        {code ? (
          <View style={[styles.codeCard, { borderColor: t.colors.kesar }]}>
            <Text style={{ fontFamily: t.font.monoBold, fontSize: 30, letterSpacing: 4, color: t.colors.kesar }}>{code}</Text>
            <Text style={{ fontFamily: t.font.mono, fontSize: 11, color: t.colors.paperDim, marginTop: 8 }}>
              Enter this on your other device within 15 minutes. Single use.
            </Text>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            disabled={disabled || busy !== null}
            onPress={getCode}
            style={[styles.button, { backgroundColor: t.colors.kesar, opacity: disabled ? 0.4 : 1 }]}
          >
            {busy === 'get' ? <ActivityIndicator color={t.colors.ink} /> : (
              <Text style={{ fontFamily: t.font.brand, fontSize: 16, letterSpacing: 1, color: t.colors.ink }}>GET A CODE</Text>
            )}
          </Pressable>
        )}

        {/* Restore from a code — claim */}
        <Text style={[styles.sectionTitle, { color: t.colors.paperDim }]}>I HAVE A CODE</Text>
        <TextInput
          value={entry}
          onChangeText={setEntry}
          editable={!disabled && busy === null}
          placeholder="ENTER CODE"
          placeholderTextColor={t.colors.paperDim}
          autoCapitalize="characters"
          autoCorrect={false}
          accessibilityLabel="Transfer code"
          style={[styles.input, { color: t.colors.paper, borderColor: t.colors.railTrack, backgroundColor: t.colors.ink2 }]}
        />
        <Pressable
          accessibilityRole="button"
          disabled={disabled || busy !== null || entry.trim().length === 0}
          onPress={claim}
          style={[styles.buttonOutline, { borderColor: t.colors.kesar, opacity: disabled || entry.trim().length === 0 ? 0.4 : 1 }]}
        >
          {busy === 'claim' ? <ActivityIndicator color={t.colors.kesar} /> : (
            <Text style={{ fontFamily: t.font.brand, fontSize: 16, letterSpacing: 1, color: t.colors.kesar }}>RESTORE MY HISTORY</Text>
          )}
        </Pressable>

        {msg && (
          <Text
            accessibilityLiveRegion="polite"
            style={{ fontFamily: t.font.body, fontSize: 14, lineHeight: 21, marginTop: 18, color: msg.kind === 'ok' ? t.colors.confirm : t.colors.signal }}
          >
            {msg.text}
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
  sectionTitle: { fontFamily: 'MartianMono_500Medium', fontSize: 11, letterSpacing: 2, marginTop: 30, marginBottom: 14 },
  codeCard: { borderWidth: 1, borderRadius: 14, paddingVertical: 22, paddingHorizontal: 20, alignItems: 'center' },
  button: { borderRadius: 12, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  buttonOutline: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', minHeight: 52, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, fontFamily: 'MartianMono_500Medium', fontSize: 18, letterSpacing: 3, textAlign: 'center' },
});
