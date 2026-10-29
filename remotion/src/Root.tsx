import React from 'react';
import { Composition } from 'remotion';
import { PromoClip } from './PromoClip';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PromoClip"
        component={PromoClip}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          title: 'Kantor-Rama-AI',
          subtitle: 'Autonomous Multi-Agent Virtual Office',
          accentColor: '#10b981',
        }}
      />
    </>
  );
};
