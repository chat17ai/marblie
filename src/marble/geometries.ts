import { ExtrudeGeometry, Shape } from "three"; // Removed ShapeGeometry
import { defaults } from "./config";

interface TrackGeometryParams {
  width: number;
  height: number;
  depth: number;
  trackWidth: number;
  trackDepth: number;
}

export function curveTrackGeometry(shape: THREE.Shape, curve: THREE.Curve<THREE.Vector3>): THREE.ExtrudeGeometry {
  const extrusion = new ExtrudeGeometry(shape, {
    steps: 50,
    bevelEnabled: false,
    extrudePath: curve,
  });

  // It seems 'defaults.width' might be problematic if it's not always the intended offset.
  // For now, leaving as is, but this could be a point of refinement.
  extrusion.translate(defaults.width, 0, 0);

  return extrusion;
}

export function straightTrackGeometry(params: TrackGeometryParams): THREE.ExtrudeGeometry {
  const { width, height, depth, trackWidth, trackDepth } = params;
  // Pass all params to trackShape as it might need them, even if not all are used directly in its own logic
  const profile = trackShape({ width, height, depth, trackWidth, trackDepth });

  const extrudeSettings = {
    steps: 1,
    depth: depth,
    bevelEnabled: true,
    bevelThickness: 0,
    bevelSize: 0,
    // bevelOffset: 0,
    // bevelSegments: 0,
  };

  const geometry = new ExtrudeGeometry(profile, extrudeSettings).translate(
    0,
    0,
    -depth / 2
  );

  return geometry;
}

// depth is passed but not used directly in this function's logic, only passed down.
// It's included in TrackGeometryParams for use in straightTrackGeometry.
export function trackShape({ width, height, trackWidth, trackDepth }: TrackGeometryParams): THREE.Shape {
  const wallWidth = (width - trackWidth) / 2;
  const profile = new Shape();

  profile.moveTo(0, 0);
  profile.lineTo(0, -height / 2);
  profile.lineTo(0 + wallWidth, -height / 2);
  profile.lineTo(0 + wallWidth, -height / 2 + trackDepth);
  profile.lineTo(0 + wallWidth + trackWidth, -height / 2 + trackDepth);
  profile.lineTo(0 + wallWidth + trackWidth, -height / 2);
  profile.lineTo(0 + wallWidth + trackWidth + wallWidth, -height / 2);
  profile.lineTo(0 + wallWidth + trackWidth + wallWidth, -height / 2 + height);
  profile.lineTo(0 + wallWidth + trackWidth, -height / 2 + height);
  profile.lineTo(0 + wallWidth + trackWidth, -height / 2 + height - trackDepth);
  profile.lineTo(0 + wallWidth, -height / 2 + height - trackDepth);
  profile.lineTo(0 + wallWidth, -height / 2 + height);
  profile.lineTo(0, -height / 2 + height);
  profile.lineTo(0, 0);

  return profile;
}

interface AnchorShapeDimensions {
  width?: number;
  height?: number;
}

export function anchorShape(dimensions: AnchorShapeDimensions): THREE.Shape {
  const { width = 1.2, height = 0.7 } = dimensions;

  const profile = new Shape();

  profile.moveTo(-width / 2, -height / 2);
  profile.lineTo(width / 2, -height / 2);
  profile.lineTo(width / 2, height / 2);
  profile.arc(-width / 2, 0, width / 2, 0, Math.PI);
  profile.lineTo(-width / 2, -height / 2);

  return profile;
}

interface HalfPillGeometryDimensions extends AnchorShapeDimensions {
  depth?: number;
  trackWidth: number; // trackWidth is required
}

export function halfPillGeometry(dimensions: HalfPillGeometryDimensions): THREE.ExtrudeGeometry {
  const { depth = 0.2, trackWidth } = dimensions;
  // Pass all relevant parts of dimensions to anchorShape
  const profile = anchorShape({ width: dimensions.width, height: dimensions.height });

  const extrudeSettings = {
    steps: 1,
    depth: depth,
    bevelEnabled: true,
    bevelThickness: 0,
    bevelSize: 0,
    // bevelOffset: 0,
    // bevelSegments: 5,
  };

  const geometry = new ExtrudeGeometry(profile, extrudeSettings)
    .rotateY(Math.PI / 2)
    .translate(-trackWidth / 2 - depth, 0, 0);

  return geometry;
}
