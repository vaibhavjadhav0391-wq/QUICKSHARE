import * as React from "react";
import { cn } from "@/lib/utils";

export interface MenuItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  gradient: string;
  iconColor: string;
}

export interface MenuBarProps extends React.HTMLAttributes<HTMLDivElement> {
  items: MenuItem[];
  activeItem?: string;
  onItemClick?: (label: string) => void;
}

export const MenuBar = React.forwardRef<HTMLDivElement, MenuBarProps>(
  ({ className, items, activeItem, onItemClick, ...props }, ref) => {
    return (
      <nav
        ref={ref}
        className={cn(
          "p-1.5 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-xl relative overflow-hidden",
          className
        )}
        {...props}
      >
        <ul className="flex items-center gap-1.5 relative z-10">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.label === activeItem;

            return (
              <li key={item.label} className="relative">
                <button
                  onClick={() => onItemClick?.(item.label)}
                  className="block w-full text-left focus:outline-none"
                >
                  <div
                    className={cn(
                      "flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all duration-200 relative overflow-hidden whitespace-nowrap select-none",
                      isActive
                        ? "bg-white/15 text-white font-semibold shadow-inner border border-white/20"
                        : "text-white/70 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10"
                    )}
                  >
                    {/* Ambient Glow Pill on Active/Hover */}
                    <div
                      className={cn(
                        "absolute inset-0 pointer-events-none transition-opacity duration-300 rounded-xl opacity-0",
                        isActive && "opacity-100"
                      )}
                      style={{
                        background: item.gradient,
                      }}
                    />

                    <span
                      className={cn(
                        "transition-colors duration-200 relative z-10 flex items-center justify-center",
                        isActive ? item.iconColor : "text-white/70 group-hover:text-white"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>

                    <span className="text-xs sm:text-sm font-medium tracking-wide relative z-10 whitespace-nowrap">
                      {item.label}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }
);

MenuBar.displayName = "MenuBar";
