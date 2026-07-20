import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatDecimalHoursToTime = (decimalHours) => {
  // Ensure the number is positive for correct calculation
  const absHours = Math.abs(decimalHours);

  // 1. Calculate total minutes
  const totalMinutes = Math.round(absHours * 60);

  // 2. Calculate Hours and Minutes
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  // 3. Format with leading zeros (e.g., 5 becomes 05)
  const formattedHours = String(hours).padStart(2, "0");
  const formattedMinutes = String(minutes).padStart(2, "0");

  // 4. Return the combined string
  return `${formattedHours}:${formattedMinutes}`;
};

export const convertToPersianDigits = (value: string) => {
  const persianNumerals = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  const englishNumerals = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

  let result = value;

  for (let i = 0; i < englishNumerals.length; i++) {
    const regex = new RegExp(englishNumerals[i], "g");
    result = result.replace(regex, persianNumerals[i]);
  }

  return result;
};

import {
  Code2,
  Code,
  Smartphone,
  Zap,
  Globe,
  Heart,
  Star,
  Camera,
  Settings,
  Rocket,
  User,
  Feather,
  Calendar,
  Briefcase,
  Coffee,
  Palette,
  Database,
  BarChart3,
  Brain,
  Shield,
} from "lucide-react";

export const iconMap: Record<string, any> = {
  Code2,
  Code,
  Smartphone,
  Globe,
  Heart,
  Star,
  Camera,
  Settings,
  Rocket,
  User,
  Feather,
  Zap,
  Calendar,
  Briefcase,
  Coffee,
  Palette,
  Database,
  BarChart3,
  Brain,
  Shield,
};
