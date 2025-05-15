import { IPoint, IPoints, IPolygons } from "./interfaces";
import * as p2 from "p2-es";
import { normalizePoints } from "./letter-util";
import { RefObject } from "react";
import * as decomp from "poly-decomp-es";

export const WOOD_MATERIAL = new p2.Material();

const decomposePolygon = (polygon: IPoints): IPolygons => {
  // Copied from the source.
  const p = [];
  for (let i = 0; i < polygon.length; i++) {
    p[i] = p2.vec2.clone(polygon[i]);
  }
  decomp.makeCCW(p as decomp.Polygon);
  decomp.removeCollinearPoints(p as decomp.Polygon);
  const convexes = decomp.quickDecomp(p as decomp.Polygon);
  return convexes as IPolygons;
};

const makeRelativeToOrigin = (polygon: IPoints, origin: IPoint) => {
  return polygon.map((point) => [point[0] - origin[0], point[1] - origin[1]]);
};

const findCenterOfPoints = (points: IPoints): IPoint => {
  const sumX = points.reduce((sum, point) => sum + point[0], 0);
  const sumY = points.reduce((sum, point) => sum + point[1], 0);
  const avgX = sumX / points.length;
  const avgY = sumY / points.length;
  return [avgX, avgY];
};

export const createLetterFromPoints = (
  polygons: IPolygons,
  position: IPoint,
  world: p2.World,
  material: p2.Material,
  trial = false,
  normalizeFactor = 2000
): number => {
  const concaveBody = new p2.Body({
    mass: 20,
    position: position,
    angularDamping: trial ? 1 : 0.01,
    damping: trial ? 1 : 0.1,
    collisionResponse: !trial,
    type: p2.Body.DYNAMIC,
  });
  polygons.forEach((polygon) => {
    decomposePolygon(normalizePoints(polygon, normalizeFactor)).forEach(
      (polygon: IPoints) => {
        const polygonCenter = findCenterOfPoints(polygon);
        const relativeToOrigin = makeRelativeToOrigin(polygon, polygonCenter);
        concaveBody.addShape(
          new p2.Convex({ vertices: relativeToOrigin }),
          polygonCenter,
          0
        );
      }
    );
  });
  concaveBody.updateMassProperties();
  concaveBody.adjustCenterOfMass();
  concaveBody.shapes.forEach((shape) => (shape.material = material));

  world.addBody(concaveBody);
  return concaveBody.id;
};

export const velocityToSpeed = (velocity: p2.Vec2) =>
  Math.sqrt(Math.pow(velocity[0], 2) + Math.pow(velocity[1], 2));

// Handle rotation start
export const handleRotationStart = (body: p2.Body) => {
  if (body.type !== p2.Body.STATIC) {
    body.type = p2.Body.KINEMATIC;
  }
};

// Handle rotation update
export const handleRotation = (body: p2.Body) => {
  if (body) {
    body.angularVelocity = 0; // Prevent continued rotation
  }
};

// Handle rotation end
export const handleRotationEnd = (body: p2.Body) => {
  body.type = p2.Body.DYNAMIC;
};

// Find the body under the given point
export const getBodyAtPoint = (
  worldRef: RefObject<p2.World | null>,
  worldPoint: [number, number]
): p2.Body | null => {
  const world = worldRef.current;
  if (!world) return null;

  // Use world.hitTest to find bodies at the given point
  const hitBodies = world.hitTest(worldPoint, world.bodies, 0.1);

  if (hitBodies.length > 0) {
    // Filter out static bodies if you don't want to drag them
    const dynamicBodies = hitBodies.filter((b) => b.type !== p2.Body.STATIC);
    return dynamicBodies.length > 0 ? dynamicBodies[0] : null;
  }

  return null;
};
