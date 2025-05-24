// src/marble/tracks/CurveTrack.tsx
import React, { useMemo } from 'react';
import { RigidBody, TrimeshCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { trackMaterials } from '../trackData';
import { defaults } from '../config';
import { trackShape, curveTrackGeometry } from '../geometries'; // Adjust path

interface CurvePoint {
  x: number;
  y: number;
  z: number;
}

interface CurveTrackProps {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  curvePoints?: CurvePoint[]; // Default to defaults.curvePoints
  // Potentially add other shape parameters as props later
}

export const CurveTrack: React.FC<CurveTrackProps> = ({
  id,
  position,
  rotation,
  curvePoints = defaults.curvePoints,
}) => {
  const {
    width, height, trackWidth, trackDepth, sections
  } = defaults;

  const curveMaterial = useMemo(() => trackMaterials.curve(), []);

  const { mainGeometry, capGeometry } = useMemo(() => {
    const shape = trackShape({ width, height, trackWidth, trackDepth });
    const points = curvePoints.map(p => new THREE.Vector3(p.x, p.y, p.z));
    const curve = new THREE.QuadraticBezierCurve3(points[0], points[1], points[2]);
    
    const mainGeom = curveTrackGeometry(shape, curve, sections);
    mainGeom.computeVertexNormals(); // Important for lighting

    const capGeom = new THREE.ShapeGeometry(shape);
    capGeom.computeVertexNormals();

    return { mainGeometry: mainGeom, capGeometry: capGeom };
  }, [curvePoints, width, height, trackWidth, trackDepth, sections]);
  
  const { cap1Transform, cap2Transform } = useMemo(() => {
    const points = curvePoints.map(p => new THREE.Vector3(p.x, p.y, p.z));
    const curve = new THREE.QuadraticBezierCurve3(points[0], points[1], points[2]);
    const startPos = curve.getPointAt(0);
    const endPos = curve.getPointAt(1);
    const startTangent = curve.getTangentAt(0);
    const endTangent = curve.getTangentAt(1);

    // const cap1Rot = new THREE.Quaternion().setFromUnitVectors(THREE.Object3D.DEFAULT_UP, startTangent.applyAxisAngle(THREE.Object3D.DEFAULT_UP, Math.PI/2 )); // This needs careful check for correct orientation
    // This is tricky. Original code:
    // const endRot1 = getSignedAngle3D(this.curve.getTangentAt(0), unitY);
    // this.cap1.rotation.set(-endRot1 + Math.PI / 2, 0, 0);
    // We need to replicate this logic for quaternion/matrix.
    // Placeholder for cap rotations, this will likely be incorrect and need refinement:
    const q1 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), Math.atan2(startTangent.x, startTangent.z) + Math.PI/2);

    const q2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), Math.atan2(endTangent.x, endTangent.z) - Math.PI/2);


    return {
        cap1Transform: { position: startPos, rotation: q1 },
        cap2Transform: { position: endPos, rotation: q2 },
    };
  }, [curvePoints]);


  if (!mainGeometry.attributes.position || !mainGeometry.index) {
      console.error("CurveTrack: Main geometry missing position or index");
      return null;
  }

  return (
    <RigidBody
      type="fixed"
      position={position}
      rotation={rotation}
      userData={{ id, type: 'CurveTrack' }}
      friction={defaults.trackFriction}
    >
      <mesh
        geometry={mainGeometry}
        material={curveMaterial}
        castShadow
        receiveShadow
      />
      {/* End Caps - position and rotation need to be precise */}
      <mesh 
        position={cap1Transform.position.toArray()} 
        quaternion={cap1Transform.rotation}
        geometry={capGeometry} 
        material={curveMaterial} castShadow receiveShadow 
      />
      <mesh 
        position={cap2Transform.position.toArray()} 
        quaternion={cap2Transform.rotation}
        geometry={capGeometry} 
        material={curveMaterial} castShadow receiveShadow 
      />
      
      <TrimeshCollider
        args={[
          mainGeometry.attributes.position.array as Float32Array,
          mainGeometry.index.array as Uint32Array,
        ]}
      />
      {/* Consider adding colliders for caps if they are substantial */}
    </RigidBody>
  );
};
