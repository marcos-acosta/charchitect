import * as p2 from "p2-es";

export type IPoint = [number, number];
export type IPoints = IPoint[];

export const AVG_LETTER_WIDTH_PIXELS = 1450;

export const combineClasses = (
  ...classes: (string | false | undefined | null)[]
) => classes.filter(Boolean).join(" ");

export const normalizePoints = (points: IPoints, factor?: number) => {
  if (!factor) {
    const xPoints = points.map((point) => point[0]);
    const minX = Math.min(...xPoints);
    const maxX = Math.max(...xPoints);
    factor = 1 / maxX - minX;
  }
  return points.map((point) => [point[0] * factor, point[1] * factor]);
};

export const createLetterFromPoints = (
  points: IPoints,
  position: IPoint,
  world: p2.World,
  material: p2.Material,
  trial = false,
  normalizeFactor = 2000
) => {
  const concaveBody = new p2.Body({
    mass: 15,
    position: position,
    angularDamping: trial ? 1 : 0.01,
    damping: trial ? 1 : 0.1,
    collisionResponse: !trial,
  });
  const letterPath = normalizePoints(points, normalizeFactor);
  concaveBody.fromPolygon(letterPath);
  concaveBody.shapes.forEach((shape) => (shape.material = material));
  world.addBody(concaveBody);
};

export const computePixelsPerMeter = (pixels: number, meters: number) =>
  pixels / meters;

export const computeMetersPerPixel = (pixels: number, meters: number) =>
  meters / pixels;
