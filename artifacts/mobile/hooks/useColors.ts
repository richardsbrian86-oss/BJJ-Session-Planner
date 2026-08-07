import colors from "@/constants/colors";

export function useColors() {
  const dark = (colors as Record<string, typeof colors.light>).dark;
  return { ...dark, radius: colors.radius };
}
