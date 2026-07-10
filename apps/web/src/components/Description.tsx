import React from 'react';
import { useSkin } from '../skins';

// The always-visible description (§3): ambient, dim, 15px, centered.
// Fixed 2-line reserve so the layout NEVER reflows when hints/chips appear.
export const Description: React.FC<{ text: string }> = ({ text }) => {
  const s = useSkin();
  return (
    <div
      style={{
        minHeight: 44,
        padding: '20px 44px 0',
        textAlign: 'center',
        fontFamily: s.fonts.body,
        fontSize: 15,
        lineHeight: 1.45,
        color: s.tokens.paperDim,
      }}
    >
      {text}
    </div>
  );
};
