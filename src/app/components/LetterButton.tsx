import { combineClasses } from "../logic/util";
import styles from "./../styles.module.css";

interface LetterButtonProps {
  letter: string;
  used: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export default function LetterButton(props: LetterButtonProps) {
  return (
    <div className={styles.letterButtonContainer}>
      <button
        className={combineClasses(
          styles.letterButton,
          props.used && styles.usedLetterButton,
          props.disabled && styles.disabled
        )}
        onClick={props.onClick}
      >
        {props.letter}
      </button>
    </div>
  );
}
