import * as p2 from "p2-es";
import { IPoint, IPoints } from "./interfaces";

export const combineClasses = (
  ...classes: (string | false | undefined | null)[]
) => classes.filter(Boolean).join(" ");

export const splitAtIndices = <T>(list: T[], indices: number[]): T[][] => {
  // Handle empty or invalid inputs
  if (!list.length || !indices.length) {
    return [list];
  }
  // Sort indices to ensure correct order
  const result: T[][] = [];
  let startIndex = 0;
  // Create sublists between each pair of indices
  for (const index of indices) {
    result.push(list.slice(startIndex, index));
    startIndex = index;
  }
  // Add final sublist from last index to end
  result.push(list.slice(startIndex));
  return result;
};
