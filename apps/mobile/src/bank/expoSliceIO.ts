/**
 * Device implementation of SliceIO (T10) — expo-file-system (legacy async API) +
 * expo-crypto. All paths live under <documentDirectory>/wordbank/. Native only;
 * the web dev harness never constructs this (Platform gate in useBankBoot).
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { BANK_DIR } from './config.ts';
import type { SliceIO } from './sliceSync.ts';

function bankPath(name: string): string {
  return `${FileSystem.documentDirectory}${BANK_DIR}/${name}`;
}

async function ensureDir(): Promise<void> {
  const dir = `${FileSystem.documentDirectory}${BANK_DIR}`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
}

export function createExpoSliceIO(): SliceIO {
  return {
    async fetchText(url: string): Promise<string> {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return res.text();
    },

    async readText(name: string): Promise<string | null> {
      try {
        return await FileSystem.readAsStringAsync(bankPath(name));
      } catch {
        return null; // missing file
      }
    },

    async writeText(name: string, content: string): Promise<void> {
      await ensureDir();
      await FileSystem.writeAsStringAsync(bankPath(name), content);
    },

    async move(from: string, to: string): Promise<void> {
      // moveAsync overwrites on iOS but can fail on Android if the target exists —
      // delete-then-move keeps the swap safe (the temp file already holds the data).
      await FileSystem.deleteAsync(bankPath(to), { idempotent: true });
      await FileSystem.moveAsync({ from: bankPath(from), to: bankPath(to) });
    },

    async remove(name: string): Promise<void> {
      await FileSystem.deleteAsync(bankPath(name), { idempotent: true });
    },

    async sha256(text: string): Promise<string> {
      return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
    },
  };
}
