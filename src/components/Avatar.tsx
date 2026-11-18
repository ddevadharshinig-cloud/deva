import { useState } from 'react';

interface AvatarProps {
  src?: string;
  alt: string;
  initials: string;
  className?: string;
}

export function Avatar({ src, alt, initials, className = 'w-8 h-8' }: AvatarProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`${className} rounded-full bg-primary-fixed text-primary font-bold text-xs flex items-center justify-center shrink-0 ring-1 ring-surface-variant`}
        aria-label={alt}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${className} rounded-full object-cover shrink-0 ring-1 ring-surface-variant`}
    />
  );
}
