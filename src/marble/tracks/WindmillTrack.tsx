// src/marble/tracks/WindmillTrack.tsx
import React, { useRef, useEffect, useMemo } from 'react';
import { RigidBody, CuboidCollider, useRapier, useRevoluteJoint } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { trackMaterials } from '../trackData'; // Adjust path
import { defaults } from '../config'; // Adjust path
import { randInt } from 'three/src/math/MathUtils.js';

interface WindmillTrackProps {
  id: string;
  position: [number, number, number];
  rotation?: [number, number, number]; // Rotation for the fixed pin
}

// Helper function to create collider props for one blade of the windmill
// Similar to StraightTrack's colliders, but using windmillDepth
const createBladeColliderArgs = (
    bladeWidth: number, 
    bladeHeight: number, 
    bladeDepth: number, // This is windmillDepth
    trackGrooveWidth: number, 
    trackGrooveDepth: number
) => {
  const wallWidth = (bladeWidth - trackGrooveWidth) / 2;

  // Collider 1: Groove base
  const grooveBaseHalfWidth = trackGrooveWidth / 2;
  const grooveBaseHalfHeight = (bladeHeight - trackGrooveDepth) / 2;
  const grooveBaseHalfDepth = bladeDepth / 2;
  const grooveBasePosition: [number, number, number] = [0, -trackGrooveDepth / 2, 0];

  // Collider 2: Left wall
  const leftWallHalfWidth = wallWidth / 2;
  const leftWallHalfHeight = bladeHeight / 2;
  const leftWallHalfDepth = bladeDepth / 2;
  const leftWallPosition: [number, number, number] = [-trackGrooveWidth / 2 - leftWallHalfWidth, 0, 0];

  // Collider 3: Right wall
  const rightWallHalfWidth = wallWidth / 2;
  const rightWallHalfHeight = bladeHeight / 2;
  const rightWallHalfDepth = bladeDepth / 2;
  const rightWallPosition: [number, number, number] = [trackGrooveWidth / 2 + rightWallHalfWidth, 0, 0];
  
  return [
    { args: [grooveBaseHalfWidth, grooveBaseHalfHeight, grooveBaseHalfDepth] as [number,number,number], position: grooveBasePosition },
    { args: [leftWallHalfWidth, leftWallHalfHeight, leftWallHalfDepth] as [number,number,number], position: leftWallPosition },
    { args: [rightWallHalfWidth, rightWallHalfHeight, rightWallHalfDepth] as [number,number,number], position: rightWallPosition },
  ];
};

export const WindmillTrack: React.FC<WindmillTrackProps> = ({
  id,
  position,
  rotation = [0, 0, 0],
}) => {
  const {
    width: defaultWidth, // Use for blade width
    height: defaultHeight, // Use for blade height
    windmillDepth,      // Use for blade depth
    trackWidth,         // Groove width
    trackDepth,         // Groove depth
  } = defaults;

  const windmillMaterial = useMemo(() => trackMaterials.windmill(), []);

  const pinRef = useRef<RapierRigidBody>(null!);
  const bladeRef = useRef<RapierRigidBody>(null!);
  
  // 使用useRevoluteJoint钩子创建关节 - 正确的参数格式
  useRevoluteJoint(
    pinRef,
    bladeRef,
    [
      [0, 0, 0], // anchorA - Center of pin
      [0, 0, 0], // anchorB - Center of blades
      [1, 0, 0]  // axis - Spin around X-axis
    ]
  );

  const bladeColliderSet1 = useMemo(() => createBladeColliderArgs(defaultWidth, defaultHeight, windmillDepth, trackWidth, trackDepth), [defaultWidth, defaultHeight, windmillDepth, trackWidth, trackDepth]);
  
  // For the second blade, rotated 90 degrees around X for visual and collider setup
  // The visual mesh will be rotated. Colliders are defined in local space of the RigidBody.
  // So, we create another set of colliders but they will be part of the same blade RigidBody.
  // To achieve the cross shape, the colliders effectively need to be for a blade oriented along Z locally if the mesh is rotated.
  // Or, easier: the RigidBody contains two groups of meshes, one rotated. Colliders are defined for that shape.

  useEffect(() => {
    if (bladeRef.current) {
      bladeRef.current.applyTorqueImpulse({ x: randInt(50, 100), y: 0, z: 0 }, true); // Increased impulse
    }
  }, []);
  
  const visualBladeArgs: [number,number,number] = [defaultWidth, defaultHeight, windmillDepth];

  return (
    <>
      {/* Fixed Pin for the Joint */}
      <RigidBody ref={pinRef} type="fixed" position={position} rotation={rotation} userData={{ id: `${id}-pin`, type: 'WindmillPin' }} />

      {/* Dynamic Blades */}
      <RigidBody
        ref={bladeRef}
        type="dynamic"
        position={position} // Blades start at the same position as the pin
        angularDamping={1}
        enabledRotations={[true, false, false]} // Allow rotation only on X-axis
        userData={{ id: `${id}-blades`, type: 'WindmillBlades' }}
        friction={defaults.trackFriction}
      >
        {/* Visual Mesh - Blade 1 (aligned with body's local XZ plane) */}
        <mesh castShadow receiveShadow material={windmillMaterial} >
          <boxGeometry args={visualBladeArgs} />
        </mesh>
        {/* Visual Mesh - Blade 2 (rotated 90 deg around X locally) */}
        <mesh castShadow receiveShadow material={windmillMaterial} rotation={[Math.PI / 2, 0, 0]} >
          <boxGeometry args={visualBladeArgs} />
        </mesh>

        {/* Colliders for Blade 1 */}
        {bladeColliderSet1.map((collider, i) => (
          <CuboidCollider key={`blade1-col-${i}`} args={collider.args} position={collider.position} />
        ))}
        
        {/* Colliders for Blade 2 (rotated locally by 90 deg around X) */}
        {/* These colliders need their positions and args transformed due to the 90deg X rotation */}
        {/* For simplicity, we define them as if the blade was oriented along local Z axis instead of local Y after X rotation */}
        {/* A CuboidCollider's orientation is fixed to its RigidBody's orientation. We achieve rotated colliders by adding them with rotated position/args or using multiple RigidBodies (more complex) or CompoundColliderShapes.
            The easiest here is to define the colliders for the cross shape directly in the local frame of the single blade RigidBody.
        */}
        {bladeColliderSet1.map((collider, i) => (
          <CuboidCollider 
            key={`blade2-col-${i}`} 
            args={collider.args} // Args are half-extents, so they effectively rotate with the body's frame
            // Position needs to be transformed from blade1's frame to blade2's frame (rotated 90 deg around X)
            // If blade1 colliders are for a Z-depth blade, blade2 colliders are for a Y-depth blade (after X rotation)
            // This means swapping Y and Z in position for the rotated set, and potentially negating one.
            // Original blade 1: args [hx, hy, hz], pos [px, py, pz]
            // Rotated blade 2: args [hx, hz, hy], pos [px, -pz, py] (rotation around X by PI/2)
            position={[collider.position[0], collider.position[2], -collider.position[1]]} // Example: Z becomes Y, Y becomes -Z
            // The args also need to be swapped if their local orientation changes relative to the body:
            // args={[collider.args[0], collider.args[2], collider.args[1]]}
          />
        ))}
      </RigidBody>
    </>
  );
};
