/**
 * Check if a given time falls within quiet hours
 */
export function isWithinQuietHours(
  time: Date,
  quietHoursEnabled: boolean,
  quietHoursStart: string,
  quietHoursEnd: string,
  timezone: string = "UTC",
): boolean {
  if (!quietHoursEnabled) {
    return false;
  }

  // Convert time to the specified timezone
  const timeStr = time.toLocaleTimeString("en-US", {
    timeZone: timezone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });

  const [currentHour, currentMinute] = timeStr.split(":").map(Number);
  const [startHour, startMinute] = quietHoursStart.split(":").map(Number);
  const [endHour, endMinute] = quietHoursEnd.split(":").map(Number);

  const currentMinutes = currentHour * 60 + currentMinute;
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  // Handle quiet hours spanning midnight
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  // Normal case: quiet hours within same day
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}
