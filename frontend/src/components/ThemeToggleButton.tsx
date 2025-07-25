import { FaSun, FaMoon } from "react-icons/fa";
import { useTheme } from "../context/ThemeContext";

const ThemeToggleButton = () => {
  const { isDarkMode, toggleTheme } = useTheme();
  return (
    <div className="flex justify-center items-center w-8 sm:w-10">
      <button
        onClick={toggleTheme}
        className="p-0.5 bg-[#0e1046] rounded-full transition-all duration-300"
      >
        <div className="relative w-7 h-4 sm:w-9 sm:h-5">
          <div
            className={`absolute w-[14px] h-[14px] sm:w-[18px] sm:h-[18px] top-[1px] bg-white rounded-full transition-all duration-300 z-10 ${
              isDarkMode
                ? "transform translate-x-[14px] sm:translate-x-[18px]"
                : ""
            }`}
          ></div>

          <FaMoon className="absolute right-[2px] top-1 text-yellow-300 transition-all duration-300 z-0 text-[10px] sm:text-xs" />

          <FaSun className="absolute left-[2px] top-1 text-yellow-300 transition-all duration-300 z-0 text-[10px] sm:text-xs" />
        </div>
      </button>
    </div>
  );
};

export default ThemeToggleButton;
