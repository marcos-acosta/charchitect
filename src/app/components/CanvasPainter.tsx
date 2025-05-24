import * as p2 from "p2-es";
import {
  ROTATION_HANDLE_DISTANCE,
  COLORS,
  getPhysicsCoord,
  setUpCanvas,
  drawHighestPoint,
  drawBox,
  drawPolygon,
  drawRotationHandle,
} from "../logic/render-util";

interface CanvasPainterProps {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  pixelsPerMeter: number;
  world: p2.World;
  panOffset: [number, number];
  highestPoint?: number;
  selectedBody?: p2.Body | null;
  readOnly?: boolean;
  mouseBody?: p2.Body | null;
}

export function paintCanvas({
  ctx,
  width,
  height,
  pixelsPerMeter,
  world,
  panOffset,
  highestPoint,
  selectedBody,
  readOnly,
  mouseBody,
}: CanvasPainterProps) {
  setUpCanvas(ctx, width, height, pixelsPerMeter);

  // Apply pan offset
  ctx.translate(panOffset[0], panOffset[1]);

  // Draw highest point line if provided
  if (highestPoint && highestPoint > 0) {
    // Convert highest point to canvas coordinates
    const lineY = highestPoint;
    drawHighestPoint(ctx, lineY, width / pixelsPerMeter);
  }

  world.bodies.forEach((body) => {
    // Skip drawing the mouse body
    if (mouseBody && body === mouseBody) return;

    ctx.save();
    ctx.translate(body.interpolatedPosition[0], body.interpolatedPosition[1]);
    ctx.rotate(body.angle);

    body.shapes.forEach((shape) => {
      const shapeOffset = shape.position;
      const shapeAngle = shape.angle;
      ctx.save();
      ctx.translate(shapeOffset[0], shapeOffset[1]);
      ctx.rotate(shapeAngle);
      if (shape instanceof p2.Box) {
        /** BOX */
        const width = shape.width;
        const height = shape.height;
        if (body.type !== p2.Body.STATIC) {
          drawBox(ctx, width, height);
        }
      } else if (shape instanceof p2.Convex) {
        /** POLYGON */
        const color = selectedBody === body ? COLORS.selected : COLORS.dynamic;
        drawPolygon(shape, ctx, color);
      }
      ctx.restore(); // Restore after each shape
    });
    ctx.restore();
  });

  // Only draw rotation handle in interactive mode (not readOnly)
  if (!readOnly && selectedBody) {
    const body = selectedBody;
    const bodyX = body.interpolatedPosition[0];
    const bodyY = body.interpolatedPosition[1];

    // Calculate handle position
    const handleX = bodyX + Math.cos(body.angle) * ROTATION_HANDLE_DISTANCE;
    const handleY = bodyY + Math.sin(body.angle) * ROTATION_HANDLE_DISTANCE;

    drawRotationHandle(ctx, bodyX, bodyY, handleX, handleY);
  }

  ctx.restore();
}
