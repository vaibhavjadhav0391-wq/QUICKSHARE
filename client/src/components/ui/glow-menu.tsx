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
    const isDarkTheme = true; // Dark glass theme active

    return (
      <nav
        ref={ref}
        className={cn(
          "p-2 rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-950/60 backdrop-blur-lg border border-white/10 shadow-lg relative overflow-hidden group/nav",
          className
        )}
        {...props}
      >
        {/* Background Ambient Radial Glow */}
        <div
          className={cn(
            "absolute -inset-2 bg-gradient-radial from-transparent transition-opacity duration-500 opacity-0 group-hover/nav:opacity-100 pointer-events-none rounded-3xl z-0",
            isDarkTheme
              ? "via-blue-400/30 via-30% via-purple-400/30 via-60% via-amber-400/30 via-90%"
              : "via-blue-400/20 via-30% via-purple-400/20 via-60% via-amber-400/20 via-90%",
            "to-transparent"
          )}
        />

        <ul className="flex items-center gap-2 relative z-10">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.label === activeItem;

            return (
              <li key={item.label} className="relative">
                <button
                  onClick={() => onItemClick?.(item.label)}
                  className="block w-full text-left"
                >
                  <div
                    className="block rounded-xl overflow-visible group/item relative transition-transform duration-300"
                    style={{ perspective: "600px" }}
                  >
                    {/* Item Radial Glow */}
                    <div
                      className="absolute inset-0 z-0 pointer-events-none transition-all duration-500 rounded-xl"
                      style={{
                        background: item.gradient,
                        opacity: isActive ? 1 : 0,
                        transform: isActive ? "scale(1.5)" : "scale(0.8)",
                      }}
                    />

                    {/* Front Face */}
                    <div
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 relative z-10 bg-transparent transition-all duration-300 rounded-xl group-hover/item:opacity-0 group-hover/item:-rotate-x-90",
                        isActive
                          ? "text-white font-semibold"
                          : "text-white/60 group-hover/item:text-white"
                      )}
                      style={{
                        transformStyle: "preserve-3d",
                        transformOrigin: "center bottom",
                      }}
                    >
                      <span
                        className={cn(
                          "transition-colors duration-300",
                          isActive ? item.iconColor : "text-white/70",
                          `group-hover/item:${item.iconColor}`
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="text-sm">{item.label}</span>
                    </div>

                    {/* 3D Rotated Back Face (Flips up on hover) */}
                    <div
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 absolute inset-0 z-10 bg-white/10 backdrop-blur-md border border-white/10 transition-all duration-300 rounded-xl opacity-0 rotate-x-90 group-hover/item:opacity-100 group-hover/item:rotate-x-0",
                        isActive
                          ? "text-white font-semibold"
                          : "text-white/80 group-hover/item:text-white"
                      )}
                      style={{
                        transformStyle: "preserve-3d",
                        transformOrigin: "center top",
                      }}
                    >
                      <span
                        className={cn(
                          "transition-colors duration-300",
                          item.iconColor
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
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
