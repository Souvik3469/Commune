import { FC } from "react";

export type MenuItem = {
  id: string;
  label: string;
  activeIcon: FC<{ className: string }>;
  inactiveIcon: FC<{ className: string }>;
  showOnMobile: boolean;
  showOnFull: boolean;
};

export interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
}

export type EmojiSelectEvent = {
  id: string;
  name: string;
  native: string;
};
