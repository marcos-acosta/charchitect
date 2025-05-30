import { useState } from "react";
import styles from "../styles.module.css";
import { combineClasses } from "../logic/util";

interface ActionButtonProps {
  text: string;
  callback: () => void;
  disabled?: boolean;
}

export default function ActionButton(props: ActionButtonProps) {
  const [isHovering, setIsHovering] = useState(false);

  return (
    <button
      onClick={props.callback}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={styles.actionButton}
      disabled={props.disabled}
    >
      <div className={styles.buttonText}>{props.text}</div>
      <div
        className={combineClasses(
          styles.arrowContainer,
          isHovering && styles.hovering
        )}
      >
        →
      </div>
    </button>
  );
}
