// src/lib/config.ts

export const TIMEZONE = 'Europe/Paris';

export function getTimezoneOffsetMs(date: Date = new Date()): number {
  const year = date.getFullYear();

  // Dernier dimanche de mars (début heure d'été)
  const march31 = new Date(year, 2, 31);
  const dstStart = new Date(year, 2, 31 - ((march31.getDay() + 7 - 0) % 7));
  dstStart.setHours(1, 0, 0, 0); // 1h UTC (passage à 3h locale)

  // Dernier dimanche d'octobre (fin heure d'été)
  const oct31 = new Date(year, 9, 31);
  const dstEnd = new Date(year, 9, 31 - ((oct31.getDay() + 7 - 0) % 7));
  dstEnd.setHours(1, 0, 0, 0); // 1h UTC (passage à 2h locale)

  const isDST = date >= dstStart && date < dstEnd;

  return isDST ? 2 * 60 * 60 * 1000 : 1 * 60 * 60 * 1000;
}