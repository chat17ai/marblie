// src/marble/tracks/RingTrack.tsx
import React, { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { RigidBody, TrimeshCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { trackMaterials, getModelPath } from '../trackData'; // Adjust path
import { defaults } from '../config'; // Adjust path

interface RingTrackProps {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
}

export const RingTrack: React.FC<RingTrackProps> = ({ id, position, rotation }) => {
  const modelPath = getModelPath('RingTrack');
  if (!modelPath) {
    console.error('RingTrack model path not found!');
    return null;
  }
  const { scene } = useGLTF(modelPath);

  const processedScene = useMemo(() => {
    const meshes: JSX.Element[] = [];
    const colliders: JSX.Element[] = [];
    let meshIndex = 0;

    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const geometry = child.geometry.clone();
        if (!geometry.attributes.position || !geometry.index) {
            console.warn("RingTrack: Mesh geometry missing position or index", child);
            return;
        }
        
        meshes.push(
          <mesh
            key={`${id}-mesh-${meshIndex}`}
            geometry={geometry}
            material={trackMaterials.ring()} // Changed material
            castShadow
            receiveShadow
          />
        );
        colliders.push(
          <TrimeshCollider
            key={`${id}-collider-${meshIndex}`}
            args={[
              geometry.attributes.position.array as Float32Array,
              geometry.index.array as Uint32Array,
            ]}
          />
        );
        meshIndex++;
      }
    });
    return { meshes, colliders };
  }, [scene, id]);

  return (
    <RigidBody
      type="fixed"
      position={position}
      rotation={rotation}
      userData={{ id, type: 'RingTrack' }} // Changed type
      friction={defaults.trackFriction}
    >
      {processedScene.meshes}
      {processedScene.colliders}
    </RigidBody>
  );
};
