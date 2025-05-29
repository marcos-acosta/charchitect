import * as p2 from "p2-es";
import {
  ROTATION_HANDLE_DISTANCE,
  COLORS,
  setUpCanvas,
  drawHighestPoint,
  drawBox,
  drawPolygon,
  drawRotationHandle,
} from "../logic/render-util";
import { isShadowLetter } from "../logic/game-util";

interface CanvasPainterProps {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  pixelsPerMeter: number;
  world: p2.World;
  panOffset: [number, number];
  highestPoint?: number | null;
  selectedBody?: p2.Body | null;
  readOnly?: boolean;
  mouseBody?: p2.Body | null;
}

export const paintCanvas = (props: CanvasPainterProps) => {
  const {
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
  } = props;

  // Set up canvas
  setUpCanvas(ctx, width, height, pixelsPerMeter);

  // Apply pan offset
  ctx.translate(panOffset[0], panOffset[1]);

  // Draw highest point if provided
  if (highestPoint !== undefined && highestPoint !== null) {
    drawHighestPoint(ctx, highestPoint, width / pixelsPerMeter);
  }

  // Draw all bodies
  for (const body of world.bodies) {
    // Skip mouse body
    if (body === mouseBody) continue;

    // Set color based on state
    if (isShadowLetter(body)) {
      ctx.fillStyle = "rgba(128, 128, 128, 0.5)";
      ctx.strokeStyle = "rgba(128, 128, 128, 0.5)";
    } else if (body === selectedBody) {
      ctx.fillStyle = COLORS.selected;
      ctx.strokeStyle = COLORS.selected;
    } else {
      ctx.fillStyle = COLORS.dynamic;
      ctx.strokeStyle = COLORS.dynamic;
    }

    // Draw each shape in the body
    for (const shape of body.shapes) {
      ctx.save();
      ctx.translate(body.interpolatedPosition[0], body.interpolatedPosition[1]);
      ctx.rotate(body.angle);

      if (shape instanceof p2.Box) {
        drawBox(ctx, shape.width, shape.height);
      } else if (shape instanceof p2.Convex) {
        ctx.save();
        ctx.translate(shape.position[0], shape.position[1]);
        ctx.rotate(shape.angle);
        drawPolygon(shape, ctx, ctx.fillStyle);
        ctx.restore();
      }

      ctx.restore();
    }

    // Draw rotation handle if body is selected and not in read-only mode
    if (body === selectedBody && !readOnly) {
      const bodyX = body.interpolatedPosition[0];
      const bodyY = body.interpolatedPosition[1];
      const handleX = bodyX + Math.cos(body.angle) * ROTATION_HANDLE_DISTANCE;
      const handleY = bodyY + Math.sin(body.angle) * ROTATION_HANDLE_DISTANCE;
      drawRotationHandle(ctx, bodyX, bodyY, handleX, handleY);
    }
  }
};
