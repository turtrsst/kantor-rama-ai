import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig, AbsoluteFill } from 'remotion';

export const PromoClip: React.FC<{
  title: string;
  subtitle: string;
  accentColor: string;
}> = ({ title, subtitle, accentColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const scale = interpolate(frame, [0, 150], [1, 1.1]);

  return (
    <AbsoluteFill style={{ 
      backgroundColor: '#0a0a0a', 
      color: 'white', 
      justifyContent: 'center', 
      alignItems: 'center',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ opacity, transform: `scale(${scale})`, textAlign: 'center' }}>
        <h1 style={{ fontSize: 120, margin: 0, color: accentColor }}>{title}</h1>
        <p style={{ fontSize: 40, opacity: 0.8 }}>{subtitle}</p>
      </div>
    </AbsoluteFill>
  );
};
