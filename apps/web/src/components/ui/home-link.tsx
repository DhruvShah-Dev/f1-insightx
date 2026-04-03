import Link from "next/link";

type HomeLinkProps = {
  href?: string;
  className?: string;
};

export function HomeLink({ href = "/", className = "" }: HomeLinkProps) {
  return (
    <Link href={href} className={`subpage-link subpage-link--icon ${className}`.trim()} aria-label="Home">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M4 10.75 12 4l8 6.75V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}
