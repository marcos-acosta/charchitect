import React, { useState, useRef, useEffect } from "react";

interface CircularAnglePickerProps {
  angle: number; // Current angle in degrees (0-359)
  size?: number; // Size of the dial in pixels
  disabled?: boolean; // Whether the control is disabled
  onChange?: (angle: number) => void; // Callback when angle changes during drag
  onChangeStart?: () => void; // Callback when starting to change angle
  onChangeEnd?: () => void; // Callback when finished changing angle
  primaryColor?: string; // Color for the indicator and center dot
  secondaryColor?: string; // Color for the dial border
}

export default function CircularAnglePicker({
  angle,
  size = 80,
  disabled = false,
  onChange,
  onChangeStart,
  onChangeEnd,
  primaryColor = "#367beb",
  secondaryColor = "#ccc",
}: CircularAnglePickerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dialRef = useRef<HTMLDivElement>(null);

  // Calculate angle from mouse/touch position
  const calculateAngleFromEvent = (
    clientX: number,
    clientY: number
  ): number => {
    if (!dialRef.current) return angle;

    const rect = dialRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Calculate angle in radians
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    let angleRad = Math.atan2(dy, dx);

    // Convert to degrees and normalize to 0-360
    // Adding 90 degrees to start at the top (12 o'clock position)
    let degrees = (angleRad * 180) / Math.PI + 90;
    if (degrees < 0) degrees += 360;

    return Math.round(degrees) % 360;
  };

  // Handle start of interaction
  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;

    // Capture pointer to get events outside the element
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    // Calculate initial angle
    const newAngle = calculateAngleFromEvent(e.clientX, e.clientY);

    // Start dragging and notify parent
    setIsDragging(true);
    if (onChange) onChange(newAngle);
    if (onChangeStart) onChangeStart();
  };

  // Handle pointer movement during drag
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || disabled) return;

    const newAngle = calculateAngleFromEvent(e.clientX, e.clientY);
    if (onChange) onChange(newAngle);
  };

  // Handle end of interaction
  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging || disabled) return;

    // Release pointer capture
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    setIsDragging(false);
    if (onChangeEnd) onChangeEnd();
  };

  return (
    <div className="circular-angle-picker" style={{ display: "inline-block" }}>
      <div
        ref={dialRef}
        style={{
          position: "relative",
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: "50%",
          border: `2px solid ${secondaryColor}`,
          backgroundColor: "white",
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.6 : 1,
          touchAction: "none", // Prevents default touch actions
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Angle indicator needle */}
        <div
          style={{
            position: "absolute",
            width: "2px",
            height: `${size / 2 - 4}px`,
            backgroundColor: primaryColor,
            left: "50%",
            top: "4px",
            transformOrigin: "bottom center",
            transform: `translateX(-50%) rotate(${angle}deg)`,
          }}
        />

        {/* Center dot */}
        <div
          style={{
            position: "absolute",
            width: `${size / 10}px`,
            height: `${size / 10}px`,
            backgroundColor: primaryColor,
            borderRadius: "50%",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />

        {/* Small tick at 0 degrees (top) */}
        <div
          style={{
            position: "absolute",
            width: "2px",
            height: "6px",
            backgroundColor: secondaryColor,
            left: "50%",
            top: "0",
            transform: "translateX(-50%)",
          }}
        />

        {/* Small tick at 90 degrees (right) */}
        <div
          style={{
            position: "absolute",
            width: "6px",
            height: "2px",
            backgroundColor: secondaryColor,
            right: "0",
            top: "50%",
            transform: "translateY(-50%)",
          }}
        />

        {/* Small tick at 180 degrees (bottom) */}
        <div
          style={{
            position: "absolute",
            width: "2px",
            height: "6px",
            backgroundColor: secondaryColor,
            left: "50%",
            bottom: "0",
            transform: "translateX(-50%)",
          }}
        />

        {/* Small tick at 270 degrees (left) */}
        <div
          style={{
            position: "absolute",
            width: "6px",
            height: "2px",
            backgroundColor: secondaryColor,
            left: "0",
            top: "50%",
            transform: "translateY(-50%)",
          }}
        />
      </div>

      {/* Angle value display */}
      <div
        style={{
          textAlign: "center",
          marginTop: "8px",
          fontSize: `${size / 5}px`,
          color: disabled ? "#999" : "#333",
        }}
      >
        {angle}°
      </div>
    </div>
  );
}
