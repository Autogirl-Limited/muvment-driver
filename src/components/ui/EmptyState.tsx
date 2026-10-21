import Image from "next/image";

import { Spinner } from "./Spinner";

interface EmptyStateProps {
  title: string;
  description: string;
  image?: "empty" | "search" | "none";
  loading?: boolean;
  className?: string;
}

export const EmptyState = ({
  title,
  description,
  image = "empty",
  loading = false,
  className = "",
}: EmptyStateProps) => (
  <div className={`anim-fade-in flex flex-1 flex-col items-center justify-center px-8 py-14 text-center ${className}`}>
    {loading ? (
      <div className="mb-5 text-accent">
        <Spinner size={28} />
      </div>
    ) : image !== "none" ? (
      <Image
        src={image === "search" ? "/brand/search-empty.png" : "/brand/empty.png"}
        alt=""
        width={150}
        height={150}
        className="mb-5 h-36 w-36 object-contain opacity-90"
        priority={false}
      />
    ) : null}
    <h2 className="text-title-2 mb-2 text-text-2">{title}</h2>
    <p className="text-callout max-w-xs text-text-4">{description}</p>
  </div>
);
