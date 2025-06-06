export const combineClasses = (
  ...classes: (string | false | undefined | null)[]
) => classes.filter(Boolean).join(" ");

export const formatNumber = (n: number, digits: number) => n.toFixed(digits);
