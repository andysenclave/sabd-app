import { useFonts } from 'expo-font';
import { Khand_600SemiBold, Khand_700Bold } from '@expo-google-fonts/khand';
import {
  MartianMono_400Regular,
  MartianMono_500Medium,
  MartianMono_700Bold,
} from '@expo-google-fonts/martian-mono';
import { Archivo_700Bold, Archivo_800ExtraBold } from '@expo-google-fonts/archivo';
import { InstrumentSans_400Regular, InstrumentSans_500Medium } from '@expo-google-fonts/instrument-sans';
// Script faces — the splash/onboarding flips ONLY (शब्द → শব্দ → λέξη → SABD). Never UI text.
import { TiroDevanagariSanskrit_400Regular } from '@expo-google-fonts/tiro-devanagari-sanskrit';
import { HindSiliguri_700Bold } from '@expo-google-fonts/hind-siliguri';
import { RobotoCondensed_700Bold } from '@expo-google-fonts/roboto-condensed';

/**
 * The four brand faces from DESIGN-SYSTEM.md §3, mapped to the exact family names
 * `expo-font` registers (the imported const's identifier). Use these in `fontFamily`.
 *
 * Note on Archivo: the design calls for Archivo *Expanded* (wdth ~118–125). The static
 * Google Fonts package ships normal width only; the expanded axis is a T18/T19 fidelity
 * follow-up (variable font or Archivo Expanded specifically).
 */
export const fontFamily = {
  brandSemi: 'Khand_600SemiBold',
  brand: 'Khand_700Bold',
  mono: 'MartianMono_400Regular',
  monoMedium: 'MartianMono_500Medium',
  monoBold: 'MartianMono_700Bold',
  display: 'Archivo_700Bold',
  displayHeavy: 'Archivo_800ExtraBold',
  body: 'InstrumentSans_400Regular',
  bodyMedium: 'InstrumentSans_500Medium',
  /** शब्द mark only — splash flip, never UI text. */
  devanagari: 'TiroDevanagariSanskrit_400Regular',
  /** Bengali splash flip only. */
  bengali: 'HindSiliguri_700Bold',
  /** Greek row of the onboarding story flip (λέξη) only — Khand has no Greek. */
  greek: 'RobotoCondensed_700Bold',
} as const;

export type FontFamilyKey = keyof typeof fontFamily;

/** Load every brand face. Returns [loaded, error] from expo-font's useFonts. */
export function useAppFonts(): [boolean, Error | null] {
  return useFonts({
    Khand_600SemiBold,
    Khand_700Bold,
    MartianMono_400Regular,
    MartianMono_500Medium,
    MartianMono_700Bold,
    Archivo_700Bold,
    Archivo_800ExtraBold,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    TiroDevanagariSanskrit_400Regular,
    HindSiliguri_700Bold,
    RobotoCondensed_700Bold,
  });
}
