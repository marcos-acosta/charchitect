import { JSX, ReactNode, useEffect, useState } from "react";
import styles from "./../styles.module.css";
import { combineClasses } from "../logic/util";

interface ScreenOverlayProps {
  show: boolean;
  children: JSX.Element;
  delayMs: number;
}

export default function ScreenOverlay(props: ScreenOverlayProps) {
  const [mounted, setMounted] = useState(props.show);
  const [makeVisibleAnimated, setMakeVisibleAnimated] = useState(props.show);

  useEffect(() => {
    if (props.show) {
      setMounted(true);
      setTimeout(() => setMakeVisibleAnimated(props.show), 10);
    } else {
      setMakeVisibleAnimated(false);
      setTimeout(() => setMounted(false), props.delayMs);
    }
  }, [props.show]);

  return (
    mounted && (
      <div
        className={combineClasses(
          styles.fullScreenShadow,
          makeVisibleAnimated && styles.visibleOverlay
        )}
      >
        {props.children}
      </div>
    )
  );
}
