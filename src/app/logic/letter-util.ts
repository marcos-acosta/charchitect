import { IPoints } from "./interfaces";

export const AVG_LETTER_WIDTH_PIXELS = 1450;

export const normalizePoints = (points: IPoints, factor?: number) => {
  if (!factor) {
    const xPoints = points.map((point) => point[0]);
    const minX = Math.min(...xPoints);
    const maxX = Math.max(...xPoints);
    factor = 1 / maxX - minX;
  }
  return points.map((point) => [point[0] * factor, point[1] * factor]);
};