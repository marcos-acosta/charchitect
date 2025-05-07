import * as p2 from "p2-es";

export type IPoint = [number, number];
export type IPoints = IPoint[];

export const normalizePoints = (points: IPoints, factor?: number) => {
  if (!factor) {
    const xPoints = points.map((point) => point[0]);
    const minX = Math.min(...xPoints);
    const maxX = Math.max(...xPoints);
    factor = 1 / maxX - minX;
  }
  return points.map((point) => [point[0] / factor, point[1] / factor]);
};

export const createLetterFromPoints = (
  points: IPoints,
  position: IPoint,
  world: p2.World,
  normalizeFactor = 1500,
  stiff = false
) => {
  const concaveBody = new p2.Body({
    mass: 1,
    position: position,
    angularDamping: stiff ? 1 : 0.1,
    damping: stiff ? 1 : 0.1,
  });
  const letterPath = normalizePoints(points, normalizeFactor);
  concaveBody.fromPolygon(letterPath);
  world.addBody(concaveBody);
};
