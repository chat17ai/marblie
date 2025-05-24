// src/marble/Marble.tsx
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, BallCollider } from '@react-three/rapier';
import type { RigidBodyApi } from '@react-three/rapier';
import * as THREE from 'three';
import { randFloat } from 'three/src/math/MathUtils.js';
import { defaults } from './config';

interface MarbleProps {
  id: string | number;
  position: [number, number, number];
  hasLight: boolean;
  onDispose: (id: string | number) => void;
}

const marbleGeometry = new THREE.SphereGeometry(defaults.marbleRadius, 32, 32);

const createStandardMaterial = () => new THREE.MeshStandardMaterial({
  color: new THREE.Color("#ff0e26").offsetHSL(randFloat(-0.01, 0.01), 0, 0),
  emissive: new THREE.Color("#ffc53d"),
  emissiveIntensity: 0.1,
});

const lightAttachedMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#ffbbc2"),
  emissive: new THREE.Color("#ead5ce"),
  emissiveIntensity: 1,
});

export const Marble: React.FC<MarbleProps> = ({ id, position, hasLight, onDispose }) => {
  const rigidBodyRef = useRef<RigidBodyApi>(null);

  const material = useMemo(() => {
    return hasLight ? lightAttachedMaterial : createStandardMaterial();
  }, [hasLight]);

  useFrame(() => {
    if (rigidBodyRef.current) {
      const currentPosition = rigidBodyRef.current.translation();
      if (currentPosition.y < -50) {
        onDispose(id);
      }
    }
  });

  return (
    <RigidBody
      ref={rigidBodyRef}
      position={position}
      colliders={false} // We will add a BallCollider manually
      restitution={0.1}
      friction={defaults.marbleFriction}
      userData={{ id, type: 'Marble' }} // For debugging or events
    >
      <BallCollider args={[defaults.marbleRadius]} />
      <mesh
        castShadow
        receiveShadow
        geometry={marbleGeometry}
        material={material}
      >
        {hasLight && (
          <pointLight
            color={new THREE.Color("#ffc53d")} // From original marble light color
            intensity={1.5} // From original Marble.ts
            distance={15} // From original Marblie.ts marbleLightPool
            castShadow // From original Marblie.ts marbleLightPool
          />
        )}
      </mesh>
    </RigidBody>
  );
};
