import { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2 } from "lucide-react";

interface Reactor {
  id: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

interface ReactorListProps {
  endpointUrl: string;
  label: string;
  count: number;
  children: React.ReactNode;
  queryKey?: string[];
}

function avatarUrl(r: Reactor) {
  if (r.profileImageUrl) return r.profileImageUrl;
  const name = `${r.firstName || ""}+${r.lastName || ""}`.trim() || "?";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=FCD000&color=000`;
}

export function ReactorList({ endpointUrl, label, count, children, queryKey }: ReactorListProps) {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: reactors = [], isLoading } = useQuery<Reactor[]>({
    queryKey: queryKey ?? [endpointUrl],
    enabled: everOpened && count > 0,
    staleTime: 30_000,
  });

  const handleOpen = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
    setEverOpened(true);
  }, []);

  const handleClose = useCallback(() => {
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEverOpened(true);
    setOpen(prev => !prev);
  }, []);

  if (count === 0) {
    return <>{children}</>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          className="cursor-pointer"
          onMouseEnter={handleOpen}
          onMouseLeave={handleClose}
          onClick={handleClick}
        >
          {children}
        </span>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        className="w-52 p-2 bg-[#1a1a1a] border-white/10 text-white shadow-xl"
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        onClick={e => e.stopPropagation()}
      >
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 px-1 pb-1.5 border-b border-white/10 mb-1.5">
          {label}
        </p>
        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-0.5">
          {isLoading ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="w-4 h-4 animate-spin text-white/40" />
            </div>
          ) : reactors.length === 0 ? (
            <p className="text-xs text-white/40 text-center py-2">No one yet</p>
          ) : (
            reactors.map(r => (
              <div key={r.id} className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-white/5">
                <img
                  src={avatarUrl(r)}
                  alt={`${r.firstName} ${r.lastName}`}
                  className="w-6 h-6 rounded-full object-cover flex-shrink-0 border border-[#FDD000]/20"
                />
                <span className="text-xs font-medium text-white/90 truncate">
                  {r.firstName} {r.lastName}
                </span>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
