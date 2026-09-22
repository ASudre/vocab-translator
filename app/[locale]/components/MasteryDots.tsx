interface MasteryDotsProps {
  className?: string;
}

/** Three-dot decoration standing in for the mastery threshold (3 consecutive correct answers), reused wherever a mastery count is shown compactly. */
export function MasteryDots({ className = '' }: MasteryDotsProps) {
  return (
    <span className={`flex gap-0.5 ${className}`} aria-hidden="true">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
      <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
      <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
    </span>
  );
}
