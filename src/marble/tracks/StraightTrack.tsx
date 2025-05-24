// src/marble/tracks/StraightTrack.tsx
import React, { useMemo } from 'react';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
// import * as THREE from 'three'; // TS6133: 'THREE' is declared but its value is never read.
import { trackMaterials } from '../trackData'; // Adjust path
import { defaults } from '../config'; // Adjust path, for default dimensions

interface StraightTrackProps {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale?: [number, number, number]; // Optional, default to [1,1,1]
}

export const StraightTrack: React.FC<StraightTrackProps> = ({
  id,
  position,
  rotation,
  scale = [1, 1, 1],
}) => {
  const {
    width: defaultWidth,
    height: defaultHeight,
    depth: defaultDepth,
    trackWidth, // Width of the groove
    trackDepth, // Depth of the groove
  } = defaults;

  // Apply scale - primarily Z for depth as in original
  const actualWidth = defaultWidth * scale[0];
  const actualHeight = defaultHeight * scale[1];
  const actualDepth = defaultDepth * scale[2];

  // Visual mesh (simplified as a single box for now)
  // Dimensions: width, height, depth
  const visualMeshArgs: [number, number, number] = [actualWidth, actualHeight, actualDepth];
  const straightMaterial = useMemo(() => trackMaterials.straight(), []);

  // Collider dimensions and positions
  // Original logic:
  // Wall width: (width - trackWidth) / 2
  // Collider 1 (groove base): cuboid(width/2 - wallWidth, (height - trackDepth*2)/2, depth/2).setTranslation(width/2, 0, 0)
  // Collider 2 (left wall): cuboid((width-trackWidth)/4, height/2, depth/2).setTranslation(wallWidth/2, 0, 0)
  // Collider 3 (right wall): cuboid((width-trackWidth)/4, height/2, depth/2).setTranslation(width-wallWidth/2, 0, 0)
  // Note: These translations are relative to the track's local origin.
  // R3R CuboidCollider args are [hx, hy, hz] (half-extents)
  // R3R CuboidCollider position is [x, y, z] (center of the cuboid relative to RigidBody)

  const wallWidth = (actualWidth - trackWidth * scale[0]) / 2; // Scale trackWidth with X-scale too

  // Collider 1: Groove base (approximated)
  // Centered along X, slightly lowered to form groove bottom.
  // Width is trackWidth, height is (actualHeight - trackDepth), depth is actualDepth
  const grooveBaseHalfWidth = (trackWidth * scale[0]) / 2;
  const grooveBaseHalfHeight = (actualHeight - trackDepth * scale[1]) / 2; // take full scaled height, then reduce by trackDepth
  const grooveBaseHalfDepth = actualDepth / 2;
  const grooveBasePosition: [number, number, number] = [0, - (trackDepth * scale[1]) / 2, 0]; // Lowered by half of trackDepth

  // Collider 2: Left wall
  const leftWallHalfWidth = wallWidth / 2;
  const leftWallHalfHeight = actualHeight / 2;
  const leftWallHalfDepth = actualDepth / 2;
  const leftWallPosition: [number, number, number] = [- (trackWidth * scale[0]) / 2 - leftWallHalfWidth, 0, 0];

  // Collider 3: Right wall
  const rightWallHalfWidth = wallWidth / 2;
  const rightWallHalfHeight = actualHeight / 2;
  const rightWallHalfDepth = actualDepth / 2;
  const rightWallPosition: [number, number, number] = [(trackWidth * scale[0]) / 2 + rightWallHalfWidth, 0, 0];
  
  // Friction for colliders
  const colliderFriction = defaults.trackFriction;

  return (
    <RigidBody
      type="fixed"
      position={position}
      rotation={rotation}
      userData={{ id, type: 'StraightTrack' }}
      friction={colliderFriction} // Default friction for body
    >
      {/* Simplified Visual Mesh */}
      <mesh castShadow receiveShadow material={straightMaterial}>
        <boxGeometry args={visualMeshArgs} />
      </mesh>

      {/* Colliders - adjust carefully based on original logic */}
      {/* Collider 1: Groove Base */}
      <CuboidCollider
        args={[grooveBaseHalfWidth, grooveBaseHalfHeight, grooveBaseHalfDepth]}
        position={grooveBasePosition}
      />
      {/* Collider 2: Left Wall */}
      <CuboidCollider
        args={[leftWallHalfWidth, leftWallHalfHeight, leftWallHalfDepth]}
        position={leftWallPosition}
      />
      {/* Collider 3: Right Wall */}
      <CuboidCollider
        args={[rightWallHalfWidth, rightWallHalfHeight, rightWallHalfDepth]}
        position={rightWallPosition}
      />
    </RigidBody>
  );
};
