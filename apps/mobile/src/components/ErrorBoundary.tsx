/**
 * Crash catcher (P4-T15). A render crash on a stranger's device is an instant
 * uninstall — this catches it, keeps the app alive with a calm recovery screen, and
 * records the error so it reaches diagnostics:
 *   - `console.error` → Android logcat → Google Play's crash/ANR vitals (automatic on
 *     the store build; no SDK needed for the soft launch).
 *   - the last error is stashed in kv so the in-app "Report a problem" screen can
 *     attach it (`lastCrash`).
 *
 * Native (non-JS) crashes are caught by Play vitals directly; this handles the JS
 * render tree, which vitals cannot see.
 */

import { Component, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { setSetting } from '@sabd/storage';
import { getStorage } from '../storage/db.ts';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }): void {
    // Reaches Play vitals via logcat on the store build.
    console.error('app crash:', error?.message, info?.componentStack);
    if (Platform.OS !== 'web') {
      try {
        setSetting(getStorage().db, 'lastCrash', {
          message: String(error?.message ?? error),
          stack: String(error?.stack ?? '').slice(0, 2000),
          at: Date.now(),
        });
      } catch {
        // Storage itself may be the thing that broke — never crash the crash handler.
      }
    }
  }

  render(): ReactNode {
    if (this.state.error === null) return this.props.children;
    return (
      <View style={styles.screen}>
        <Text style={styles.mark}>◆</Text>
        <Text style={styles.title}>Something broke.</Text>
        <Text style={styles.body}>
          Your progress is safe on this device — nothing was lost. Tap below to get back
          to the board.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Restart the app"
          onPress={() => this.setState({ error: null })}
          style={styles.button}
        >
          <Text style={styles.buttonText}>BACK TO SABD</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0E1017', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  mark: { color: '#F2A33C', fontSize: 30, marginBottom: 4 },
  title: { fontFamily: 'Archivo_800ExtraBold', fontSize: 22, color: '#E9EAF2', textAlign: 'center' },
  body: { fontFamily: 'InstrumentSans_400Regular', fontSize: 15, lineHeight: 22, color: '#8B8FA3', textAlign: 'center' },
  button: { marginTop: 12, backgroundColor: '#F2A33C', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28 },
  buttonText: { fontFamily: 'Khand_700Bold', fontSize: 16, letterSpacing: 1, color: '#0E1017' },
});
