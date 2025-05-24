import { ILetterData } from "../logic/interfaces";
import styles from "./../styles.module.css";

interface RankedTowerProps {
  rank: number;
  height: number;
  screenName: string;
  date: Date;
  letterData: ILetterData[];
}

export default function RankedTower(props: RankedTowerProps) {
  return (
    <div className={styles.rankedTowerContainer}>
      <div className={styles.rankedTowerHeader}>
        <div className={styles.rank}>Rank: {props.rank}</div>
        <div className={styles.height}>Height: {props.height}</div>
        <div className={styles.screenName}>From: {props.screenName}</div>
        <div className={styles.date}>Date: {props.date.toDateString()}</div>
      </div>
    </div>
  );
}
