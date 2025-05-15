import * as p2 from "p2-es";
import { IPoint, IPoints } from "./interfaces";

export const combineClasses = (
  ...classes: (string | false | undefined | null)[]
) => classes.filter(Boolean).join(" ");
