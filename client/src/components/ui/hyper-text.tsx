import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface HyperTextProps {
  text: string;
  duration?: number;
  className?: string;
  animateOnLoad?: boolean;
}

const alphabets = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const getRandomInt = (max: number) => Math.floor(Math.random() * max);

export function HyperText({
  text,
  duration = 800,
  className,
  animateOnLoad = true,
}: HyperTextProps) {
  const [displayText, setDisplayText] = useState(text.split(""));
  const [trigger, setTrigger] = useState(false);
  const interations = useRef(0);
  const isFirstRender = useRef(true);

  const triggerAnimation = () => {
    interations.current = 0;
    setTrigger(true);
  };

  useEffect(() => {
    const interval = setInterval(
      () => {
        if (!animateOnLoad && isFirstRender.current) {
          clearInterval(interval);
          isFirstRender.current = false;
          return;
        }
        if (interations.current < text.length) {
          setDisplayText((t) =>
            t.map((l, i) =>
              l === " "
                ? l
                : i <= interations.current
                  ? text[i]
                  : alphabets[getRandomInt(26)],
            ),
          );
          interations.current = interations.current + 0.1;
        } else {
          setTrigger(false);
          clearInterval(interval);
        }
      },
      duration / (text.length * 10),
    );
    return () => clearInterval(interval);
  }, [text, duration, trigger, animateOnLoad]);

  return (
    <div
      className="flex scale-100 cursor-pointer overflow-hidden py-1 items-center"
      onMouseEnter={triggerAnimation}
    >
      {displayText.map((letter, i) => (
        <span
          key={i}
          className={cn("font-extrabold tracking-tight transition-all duration-150 inline-block", letter === " " ? "w-2" : "", className)}
        >
          {letter}
        </span>
      ))}
    </div>
  );
}
