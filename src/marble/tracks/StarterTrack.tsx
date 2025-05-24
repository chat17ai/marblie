// src/marble/tracks/StarterTrack.tsx
import React, { useRef, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { RigidBody, TrimeshCollider, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { trackMaterials, getModelPath } from '../trackData'; // Adjust path

interface StarterTrackProps {
  id: string | number;
  position: [number, number, number];
  rotation?: [number, number, number];
}

// Define the spawn offset relative to the track's origin
export const STARTER_TRACK_SPAWN_OFFSET = new THREE.Vector3(0.9, 2.5, 0);

export const StarterTrack: React.FC<StarterTrackProps> = ({ id, position, rotation }) => {
  const modelPath = getModelPath('StarterTrack');
  if (!modelPath) {
    console.error('StarterTrack model path not found!');
    return null;
  }
  const { scene } = useGLTF(modelPath);
  const rigidBodyRef = useRef<RapierRigidBody>(null);

  // Memoize processed scene to avoid re-creating meshes and colliders on every render
  const processedScene = useMemo(() => {
    const meshes: React.ReactElement[] = [];
    const colliders: React.ReactElement[] = [];
    let meshIndex = 0;

    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Ensure geometry is clean and has attributes
        const geometry = child.geometry.clone(); // Clone to avoid issues if GLTF is used elsewhere
        if (!geometry.attributes.position || !geometry.index) {
            console.warn("StarterTrack: Mesh geometry missing position or index", child)
            // Potentially skip this mesh or use ConvexHullCollider as fallback
            return;
        }
        
        meshes.push(
          <mesh
            key={`${id}-mesh-${meshIndex}`}
            geometry={geometry}
            material={trackMaterials.starter()} // Apply starter material
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
      ref={rigidBodyRef}
      type="fixed"
      position={position}
      rotation={rotation} // Apply rotation if needed
      userData={{ id, type: 'StarterTrack' }}
    >
      {processedScene.meshes}
      {processedScene.colliders}
    </RigidBody>
  );
};
