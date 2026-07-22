/**
 * Settings (T23): the privacy paragraph, haptics toggle, replay-onboarding, and
 * "Send my data" — the manual playtest feedback loop from the event-log doc §8.
 *
 * The export screen shows the ACTUAL rounds/fields/count before anything moves
 * (contextual, inspectable consent — not a blanket startup wall). Cancel/Send →
 * share sheet → JSON file. `synced_at` stays untouched (the manual loop never
 * stamps it).
 */
import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Switch, ScrollView, Platform, AccessibilityInfo } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { buildExport, serializeExport, getSetting, setSetting } from '@sabd/storage';

import { useTheme } from '../src/theme';
import { getStorage } from '../src/storage/db';

export default function Settings() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [haptics, setHaptics] = useState(() => readHaptics());
  const [exportOpen, setExportOpen] = useState(false);

  const toggleHaptics = useCallback((v: boolean) => {
    setHaptics(v);
    if (Platform.OS !== 'web') {
      try {
        setSetting(getStorage().db, 'hapticsEnabled', v);
      } catch (err) {
        console.error('settings: failed to save hapticsEnabled', err);
      }
    }
  }, []);

  const replayOnboarding = useCallback(() => {
    if (Platform.OS !== 'web') {
      try {
        setSetting(getStorage().db, 'onboardingSeen', false);
      } catch (err) {
        console.error('settings: failed to reset onboarding', err);
      }
    }
    router.push('/onboarding');
  }, [router]);

  return (
    <View style={[styles.screen, { backgroundColor: t.colors.ink, paddingTop: insets.top + 20 }]}>
      <View style={styles.header} importantForAccessibility={exportOpen ? 'no-hide-descendants' : 'auto'}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={styles.back}
          hitSlop={8}
        >
          <Text style={{ fontFamily: t.font.mono, fontSize: 20, color: t.colors.paperDim }}>←</Text>
        </Pressable>
        <Text style={{ fontFamily: t.font.brand, fontSize: 22, letterSpacing: 1, color: t.colors.paper }}>
          SETTINGS
        </Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        importantForAccessibility={exportOpen ? 'no-hide-descendants' : 'auto'}
      >
        {/* Privacy — one honest paragraph. */}
        <Section title="PRIVACY">
          <Text style={{ fontFamily: t.font.body, fontSize: 14, lineHeight: 21, color: t.colors.paperDim }}>
            Your games are stored on this device. Nothing is sent anywhere unless you tap
            “Send my data” below.
          </Text>
        </Section>

        <Section title="GAMEPLAY">
          <Row>
            <Text style={{ fontFamily: t.font.body, fontSize: 15, color: t.colors.paper }}>Haptics</Text>
            <Switch
              value={haptics}
              onValueChange={toggleHaptics}
              accessibilityLabel="Haptics"
              trackColor={{ false: t.colors.ink2, true: t.colors.kesar }}
            />
          </Row>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Replay onboarding"
            onPress={replayOnboarding}
            style={styles.linkRow}
          >
            <Text style={{ fontFamily: t.font.body, fontSize: 15, color: t.colors.paper }}>
              Replay onboarding
            </Text>
            <Text importantForAccessibility="no" style={{ color: t.colors.paperDim }}>
              ›
            </Text>
          </Pressable>
        </Section>

        <Section title="ACCOUNT">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sync across devices"
            onPress={() => router.push('/sync')}
            style={styles.linkRow}
          >
            <Text style={{ fontFamily: t.font.body, fontSize: 15, color: t.colors.paper }}>Sync across devices</Text>
            <Text importantForAccessibility="no" style={{ color: t.colors.paperDim }}>›</Text>
          </Pressable>
        </Section>

        <Section title="HELP">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Report a problem"
            onPress={() => router.push('/feedback')}
            style={styles.linkRow}
          >
            <Text style={{ fontFamily: t.font.body, fontSize: 15, color: t.colors.paper }}>Report a problem</Text>
            <Text importantForAccessibility="no" style={{ color: t.colors.paperDim }}>›</Text>
          </Pressable>
        </Section>

        <Section title="YOUR DATA">
          <Text style={{ fontFamily: t.font.body, fontSize: 13, lineHeight: 19, color: t.colors.paperDim, marginBottom: 12 }}>
            This helps tune word difficulty. Nothing else is included.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setExportOpen(true)}
            style={[styles.sendButton, { backgroundColor: t.colors.kesar }]}
          >
            <Text style={{ fontFamily: t.font.brand, fontSize: 16, letterSpacing: 1, color: t.colors.ink }}>
              SEND MY DATA
            </Text>
          </Pressable>
        </Section>
      </ScrollView>

      {exportOpen && <ExportPreview onClose={() => setExportOpen(false)} />}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.section}>
      <Text style={{ fontFamily: t.font.mono, fontSize: 11, letterSpacing: 2, color: t.colors.paperDim, marginBottom: 10 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

/**
 * The export preview — must show the ACTUAL data, not a description of it
 * (event-log doc §8). Empty state for zero rounds; never a zero-byte file.
 */
function ExportPreview({ onClose }: { onClose: () => void }) {
  const t = useTheme();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  let file;
  try {
    file = Platform.OS !== 'web' ? buildExport(getStorage().db, Date.now()) : null;
  } catch (err) {
    console.error('settings: buildExport failed', err);
    file = null;
  }

  const rounds = file?.rounds ?? [];
  const empty = rounds.length === 0;

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(
      empty ? 'Nothing to send yet dialog opened' : `Send my data dialog opened, ${rounds.length} rounds`,
    );
    // announce once, on open, regardless of later state changes within the dialog
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback(async () => {
    if (!file) return;
    setSending(true);
    try {
      const json = serializeExport(file);
      const path = `${FileSystem.cacheDirectory}sabd-export-${file.exportedAt}.json`;
      await FileSystem.writeAsStringAsync(path, json);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Send my Sabd data' });
      }
      setSent(true);
    } catch (err) {
      console.error('settings: export send failed', err);
    } finally {
      setSending(false);
    }
  }, [file]);

  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <View style={[styles.sheet, { backgroundColor: t.colors.ink2 }]}>
        <Text style={{ fontFamily: t.font.brand, fontSize: 18, color: t.colors.paper, marginBottom: 8 }}>
          {empty ? 'Nothing to send yet' : 'Send my data'}
        </Text>

        {empty ? (
          <Text style={{ fontFamily: t.font.body, fontSize: 14, color: t.colors.paperDim, lineHeight: 20 }}>
            Play a round first — there’s nothing recorded on this device yet.
          </Text>
        ) : sent ? (
          <Text style={{ fontFamily: t.font.body, fontSize: 14, color: t.colors.paperDim, lineHeight: 20 }}>
            Sent. Thank you — this genuinely helps tune the word difficulty.
          </Text>
        ) : (
          <>
            <Text style={{ fontFamily: t.font.body, fontSize: 14, color: t.colors.paperDim, lineHeight: 20, marginBottom: 14 }}>
              {rounds.length} round{rounds.length === 1 ? '' : 's'} will be sent, exactly as recorded:
              word, topic, solved/timed-out, time used, hints used, and your rating before/after.
              No names, no location, no device info.
            </Text>
            <View style={styles.previewBox}>
              {rounds.slice(0, 4).map((r) => (
                <Text
                  key={r.roundId}
                  style={{ fontFamily: t.font.mono, fontSize: 11, color: t.colors.paperDim, marginBottom: 4 }}
                >
                  {r.wordId} · {r.solved ? 'solved' : 'timeout'} · {Math.round(r.timeUsedSec)}s
                </Text>
              ))}
              {rounds.length > 4 && (
                <Text style={{ fontFamily: t.font.mono, fontSize: 11, color: t.colors.paperDim }}>
                  +{rounds.length - 4} more…
                </Text>
              )}
            </View>
          </>
        )}

        <View style={styles.sheetActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={sent || empty ? 'Close' : 'Cancel'}
            onPress={onClose}
            style={styles.ghostBtn}
          >
            <Text style={{ fontFamily: t.font.brand, fontSize: 15, color: t.colors.paperDim }}>
              {sent || empty ? 'CLOSE' : 'CANCEL'}
            </Text>
          </Pressable>
          {!empty && !sent && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={sending ? 'Sending' : 'Send'}
              onPress={send}
              disabled={sending}
              style={[styles.sendBtn, { backgroundColor: t.colors.kesar, opacity: sending ? 0.6 : 1 }]}
            >
              <Text style={{ fontFamily: t.font.brand, fontSize: 15, color: t.colors.ink }}>
                {sending ? 'SENDING…' : 'SEND'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

function readHaptics(): boolean {
  if (Platform.OS === 'web') return true;
  try {
    return getSetting(getStorage().db, 'hapticsEnabled', true);
  } catch {
    return true;
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingBottom: 16,
  },
  back: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  body: { paddingHorizontal: 22, paddingBottom: 40 },
  section: { marginTop: 26 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
    marginTop: 4,
  },
  sendButton: { height: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  overlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: { width: '100%', borderRadius: 16, padding: 22 },
  previewBox: { backgroundColor: 'rgba(0,0,0,.2)', borderRadius: 8, padding: 12, marginBottom: 6 },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 20 },
  ghostBtn: { minHeight: 44, paddingHorizontal: 6, justifyContent: 'center' },
  sendBtn: { minHeight: 44, paddingHorizontal: 20, borderRadius: 8, justifyContent: 'center' },
});
