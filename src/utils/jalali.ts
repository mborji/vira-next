import jalaali from 'jalaali-js';

export interface JalaliDate {
  jy: number;
  jm: number;
  jd: number;
}

export const getCurrentJalaliDate = (): JalaliDate => {
  const today = new Date();
  return jalaali.toJalaali(today);
};

export const formatJalaliDate = (date: JalaliDate): string => {
  return `${date.jy}/${String(date.jm).padStart(2, '0')}/${String(date.jd).padStart(2, '0')}`;
};

export const getJalaliMonthName = (month: number): string => {
  const months = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر',
    'مرداد', 'شهریور', 'مهر', 'آبان',
    'آذر', 'دی', 'بهمن', 'اسفند'
  ];
  return months[month - 1];
};

export const getJalaliDayName = (dayOfWeek: number): string => {
  const days = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];
  return days[dayOfWeek];
};

export const getDaysInJalaliMonth = (year: number, month: number): number => {
  return jalaali.jalaaliMonthLength(year, month);
};

export const jalaliToGregorian = (jy: number, jm: number, jd: number): Date => {
  const gregorian = jalaali.toGregorian(jy, jm, jd);
  return new Date(gregorian.gy, gregorian.gm - 1, gregorian.gd);
};

export const gregorianToJalali = (date: Date): JalaliDate => {
  return jalaali.toJalaali(date);
};

export const formatDateForDB = (jy: number, jm: number, jd: number): string => {
  const gregorian = jalaali.toGregorian(jy, jm, jd);
  return `${gregorian.gy}-${String(gregorian.gm).padStart(2, '0')}-${String(gregorian.gd).padStart(2, '0')}`;
};