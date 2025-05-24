// src/marble/tracks/RandomTrack.tsx
import React, { useMemo } from 'react';
import { RingTrack } from './RingTrack'; // Assuming these are created and exported
import { RingLongTrack } from './RingLongTrack';
import { ConeTrack } from './ConeTrack';
import { TubeTrack } from './TubeTrack';
import { randInt } from 'three/src/math/MathUtils.js';

interface RandomTrackProps {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  // Any other common props these tracks might share could be added
}

const trackChoices = [RingTrack, RingLongTrack, ConeTrack, TubeTrack];
// For display/logging purposes, map components to names
const trackNames = ['RingTrack', 'RingLongTrack', 'ConeTrack', 'TubeTrack'];


export const RandomTrack: React.FC<RandomTrackProps> = (props) => {
  const { id } = props; // position and rotation removed (TS6133) - they are in props and spread to ChosenTrack

  // Determine which track to render randomly, once per instance
  const [ChosenTrack] = useMemo(() => { // chosenTrackName removed (TS6133)
    const randomIndex = randInt(0, trackChoices.length - 1);
    console.log(`RandomTrack ${id} chose: ${trackNames[randomIndex]}`);
    return [trackChoices[randomIndex], trackNames[randomIndex]]; // chosenTrackName was here
  }, [id]); // Re-choose if ID changes, effectively making it instance-specific

  // Pass down all props. If chosen tracks have different required props,
  // this might need adjustment or ensuring all chosen tracks can handle these props.
  // For now, they all share id, position, rotation.
  return <ChosenTrack {...props} />;
};
