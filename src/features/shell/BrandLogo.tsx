import Image from "next/image";
import Link from "next/link";

/** Supplied Ready For Work brand artwork, cropped for use in the app. */
export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link className={`rw-brand-logo${compact ? " rw-brand-logo-compact" : ""}`} href="/" aria-label="Ready For Work — home">
      <Image
        src="/brand/ready-for-work-logo.png"
        alt="Ready For Work"
        width={1158}
        height={676}
        priority
        sizes={compact ? "(max-width: 760px) 116px, 158px" : "(max-width: 760px) 140px, 194px"}
      />
    </Link>
  );
}
