/**
 * The Sabd wordmark — rendered from the ACTUAL designed asset
 * (docs/design/logo-package/logo-static-retro.svg), not an approximation.
 *
 * Per LOGO.md's production note, the source SVGs are fully vector (letterforms are
 * outlined paths from Khand Bold — no webfont dependency) with only a viewBox, so they
 * scale losslessly to any size. `react-native-svg`'s `SvgXml` renders that markup
 * directly — no rasterization, no font-loading race, no cropped placeholder.
 *
 * The markup below is copied verbatim from the source file so this stays pixel-faithful
 * to what the designer shipped. If the source file changes, re-copy it here.
 */
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';

const RETRO_WORDMARK_XML = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 192">
  <rect x="20" y="13" width="440" height="12" rx="2" fill="#C98A2B"></rect>
  <rect x="20" y="25" width="440" height="2" rx="1" fill="#6E4A12"></rect>
  <g fill="#161310">
    <rect x="50.5" y="39" width="88" height="124" rx="4"></rect>
    <rect x="147.5" y="39" width="88" height="124" rx="4"></rect>
    <rect x="244.5" y="39" width="88" height="124" rx="4"></rect>
    <rect x="341.5" y="39" width="88" height="124" rx="4"></rect>
  </g>
  <g fill="#F0E6CC">
    <path d="M76.05 89.82L76.05 84.03Q76.05 76.67 81.02 72.66Q85.99 68.66 95.33 68.66Q104.67 68.66 109.27 70.59L109.27 70.59L109.27 83.84Q103.65 81.45 96.48 81.45L96.48 81.45Q92.80 81.45 91.51 82.60Q90.22 83.75 90.22 85.87L90.22 85.87L90.22 87.25Q90.22 89.82 91.10 91.06Q91.97 92.31 94.91 93.87L94.91 93.87L105.40 99.76Q112.95 103.90 112.95 112.18L112.95 112.18L112.95 117.88Q112.95 125.33 107.43 129.34Q101.91 133.34 91.92 133.34Q81.94 133.34 76.88 131.22L76.88 131.22L76.88 117.88Q83.14 120.55 91.05 120.55Q98.96 120.55 98.96 116.04L98.96 116.04L98.96 114.66Q98.96 112.55 98.09 111.49Q97.21 110.43 94.82 109.14L94.82 109.14L84.98 103.81Q76.05 98.84 76.05 89.82L76.05 89.82Z"></path>
    <path d="M213.53 132.88L200.38 132.88L197.71 118.16L185.11 118.16L182.62 132.88L169.47 132.88L181.98 69.12L201.21 69.12L213.53 132.88ZM191.27 81.82L187.04 106.47L195.69 106.47L191.27 81.82Z"></path>
    <path d="M306.95 83.75L306.95 83.75L306.95 89.73Q306.95 98.65 300.41 100.68L300.41 100.68Q307.50 102.33 307.50 111.72L307.50 111.72L307.50 118.25Q307.50 132.88 291.86 132.88L291.86 132.88L269.50 132.88L269.50 69.12L291.31 69.12Q306.95 69.12 306.95 83.75ZM289.01 80.71L289.01 80.71L283.30 80.71L283.30 94.61L289.01 94.61Q293.33 94.61 293.33 90.65L293.33 90.65L293.33 84.67Q293.33 80.71 289.01 80.71ZM293.88 117.33L293.88 117.33L293.88 110.80Q293.88 106.84 289.56 106.84L289.56 106.84L283.30 106.84L283.30 121.29L289.56 121.29Q293.88 121.29 293.88 117.33Z"></path>
    <path d="M390.70 116.78L390.70 83.84Q390.70 82.19 389.92 81.31Q389.13 80.44 386.93 80.44L386.93 80.44L380.30 80.44L380.30 121.01L386.93 121.01Q390.70 121.01 390.70 116.78L390.70 116.78ZM366.50 132.88L366.50 69.12L388.86 69.12Q396.31 69.12 400.40 72.71Q404.50 76.30 404.50 83.29L404.50 83.29L404.50 117.88Q404.50 132.88 389.69 132.88L389.69 132.88L366.50 132.88Z"></path>
  </g>
  <g fill="#000000" opacity="0.85">
    <rect x="50.5" y="99.5" width="88" height="3"></rect>
    <rect x="147.5" y="99.5" width="88" height="3"></rect>
    <rect x="244.5" y="99.5" width="88" height="3"></rect>
    <rect x="341.5" y="99.5" width="88" height="3"></rect>
  </g>
</svg>
`;

/** Intrinsic aspect ratio of the wordmark viewBox (480×192 → 2.5:1). */
export const WORDMARK_ASPECT_RATIO = 480 / 192;

export interface WordmarkProps {
  width: number;
}

/**
 * The full flap-card SABD wordmark. Renders at any size with zero quality loss.
 * Purely decorative branding — the screen title already conveys "Sabd", so this is
 * hidden from the accessibility tree rather than left to read as an unlabeled node.
 */
export function Wordmark({ width }: WordmarkProps) {
  return (
    <View accessible={false} importantForAccessibility="no">
      <SvgXml xml={RETRO_WORDMARK_XML} width={width} height={width / WORDMARK_ASPECT_RATIO} />
    </View>
  );
}
