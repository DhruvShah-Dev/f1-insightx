"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

type AssetImageProps = {
  src: string;
  fallbackSrc: string;
  alt: string;
  className: string;
  sizes?: string;
  priority?: boolean;
  style?: CSSProperties;
  unoptimized?: boolean;
} & (
  | {
      fill: true;
      width?: never;
      height?: never;
    }
  | {
      fill?: false;
      width: number;
      height: number;
    }
);

export function AssetImage({
  src,
  fallbackSrc,
  alt,
  className,
  fill,
  width,
  height,
  sizes,
  priority = false,
  style,
  unoptimized,
}: AssetImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src);

  useEffect(() => {
    setCurrentSrc(src);
  }, [src]);

  const shouldBypassOptimizer = unoptimized ?? currentSrc.startsWith("/assets/");

  return (
    <Image
      src={currentSrc}
      alt={alt}
      className={className}
      fill={fill}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      sizes={sizes}
      priority={priority}
      unoptimized={shouldBypassOptimizer}
      style={style}
      onError={() => {
        if (currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
        }
      }}
    />
  );
}
