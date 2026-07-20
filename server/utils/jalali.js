import jalaali from "jalaali-js";

const formatGregorianDate = ({ gy, gm, gd }) =>
  `${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`;

/** Gregorian date range (inclusive) for a Jalali calendar year. */
export function getJalaliYearGregorianRange(jy) {
  const start = jalaali.toGregorian(jy, 1, 1);
  const lastDay = jalaali.jalaaliMonthLength(jy, 12);
  const end = jalaali.toGregorian(jy, 12, lastDay);
  return {
    startDate: formatGregorianDate(start),
    endDate: formatGregorianDate(end),
  };
}

export function getCurrentJalaliYear() {
  return jalaali.toJalaali(new Date()).jy;
}
