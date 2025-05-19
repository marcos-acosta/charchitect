export const combineClasses = (
  ...classes: (string | false | undefined | null)[]
) => classes.filter(Boolean).join(" ");
