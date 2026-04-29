import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Users, Megaphone } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export interface MentionUser {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
}

interface MentionTextareaProps
  extends Omit<React.ComponentProps<"textarea">, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
}

const NAME_RE = /(\S+)/;

function fullName(u: MentionUser): string {
  return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || "Brother";
}

function initials(u: MentionUser): string {
  const f = (u.firstName?.[0] ?? "").toUpperCase();
  const l = (u.lastName?.[0] ?? "").toUpperCase();
  return (f + l) || "?";
}

interface ActiveMention {
  // index in the textarea string of the '@' character that started the trigger
  start: number;
  // current text after the '@'
  query: string;
}

/**
 * Detects an in-progress @-mention at the caret. Returns null when not
 * actively mentioning (no '@', or '@' followed by whitespace/newline, etc).
 */
function findActiveMention(text: string, caret: number): ActiveMention | null {
  // Walk back from caret looking for '@', stopping at whitespace
  let i = caret - 1;
  while (i >= 0) {
    const ch = text[i];
    if (ch === "@") {
      // Must be at start of string or preceded by whitespace/newline
      if (i === 0 || /\s/.test(text[i - 1])) {
        const query = text.slice(i + 1, caret);
        // Don't trigger if query already contains whitespace (mention done)
        if (/\s/.test(query)) return null;
        return { start: i, query };
      }
      return null;
    }
    if (/\s/.test(ch)) return null;
    i--;
  }
  return null;
}

export function MentionTextarea({
  value,
  onChange,
  className,
  onKeyDown,
  ...props
}: MentionTextareaProps) {
  const ref = React.useRef<HTMLTextAreaElement | null>(null);
  const { user } = useAuth() as { user: any };
  const isOwner = user?.role === "owner";

  const [active, setActive] = React.useState<ActiveMention | null>(null);
  const [highlight, setHighlight] = React.useState(0);

  const search = active?.query ?? "";
  const enabled = active != null && search.length >= 2;

  const { data: searchResults = [], isFetching } = useQuery<MentionUser[]>({
    queryKey: ["/api/users/search", search],
    enabled,
    queryFn: async () => {
      const res = await fetch(
        `/api/users/search?q=${encodeURIComponent(search)}`,
        { credentials: "include" }
      );
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30_000,
  });

  // Build special tokens list (always visible at top when active)
  const specials: Array<{ token: "brothers" | "everyone"; label: string; description: string }> = React.useMemo(() => {
    const list: Array<{ token: "brothers" | "everyone"; label: string; description: string }> = [];
    list.push({ token: "brothers", label: "@brothers", description: "Tag all your confirmed brothers" });
    if (isOwner) {
      list.push({ token: "everyone", label: "@everyone", description: "Tag every member (owners only)" });
    }
    return list.filter((s) => {
      if (!search) return true;
      return s.token.toLowerCase().includes(search.toLowerCase());
    });
  }, [isOwner, search]);

  const items = React.useMemo(() => {
    return [
      ...specials.map((s) => ({ kind: "special" as const, ...s })),
      ...searchResults.map((u) => ({ kind: "user" as const, user: u })),
    ];
  }, [specials, searchResults]);

  React.useEffect(() => {
    setHighlight(0);
  }, [active?.query, items.length]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    onChange(next);
    const caret = e.target.selectionStart ?? next.length;
    setActive(findActiveMention(next, caret));
  };

  const handleSelectionChange = () => {
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart ?? 0;
    setActive(findActiveMention(el.value, caret));
  };

  const closeMention = () => setActive(null);

  const insertMention = (display: string, token: string) => {
    const el = ref.current;
    if (!el || !active) return;
    const caret = el.selectionStart ?? value.length;
    const before = value.slice(0, active.start);
    const after = value.slice(caret);
    const inserted = `@[${display}](mention:${token}) `;
    const next = before + inserted + after;
    onChange(next);
    const newCaret = before.length + inserted.length;
    setActive(null);
    requestAnimationFrame(() => {
      if (ref.current) {
        ref.current.focus();
        ref.current.setSelectionRange(newCaret, newCaret);
      }
    });
  };

  const pickActive = () => {
    const item = items[highlight];
    if (!item) return false;
    if (item.kind === "special") {
      const display = item.token === "brothers" ? "brothers" : "everyone";
      insertMention(display, item.token);
    } else {
      insertMention(fullName(item.user), item.user.id);
    }
    return true;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (active && items.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => (h + 1) % items.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => (h - 1 + items.length) % items.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        if (pickActive()) {
          e.preventDefault();
          return;
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeMention();
        return;
      }
    }
    onKeyDown?.(e);
  };

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={handleSelectionChange}
        onKeyUp={handleSelectionChange}
        onBlur={() => {
          // Defer so click handlers on the dropdown can fire first
          setTimeout(() => setActive(null), 150);
        }}
        className={cn(className)}
        {...props}
      />

      {active && (items.length > 0 || isFetching) && (
        <div
          className="absolute z-50 mt-1 max-h-64 w-full max-w-sm overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          data-testid="mention-dropdown"
          onMouseDown={(e) => e.preventDefault()}
        >
          {items.length === 0 && isFetching && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching brothers…
            </div>
          )}
          {items.map((item, idx) => {
            const isHighlighted = idx === highlight;
            const baseCls = cn(
              "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
              isHighlighted ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
            );
            if (item.kind === "special") {
              const Icon = item.token === "brothers" ? Users : Megaphone;
              return (
                <button
                  type="button"
                  key={item.token}
                  className={baseCls}
                  onMouseEnter={() => setHighlight(idx)}
                  onClick={() => {
                    setHighlight(idx);
                    pickActive();
                  }}
                  data-testid={`mention-option-${item.token}`}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="flex flex-1 flex-col">
                    <span className="font-medium">{item.label}</span>
                    <span className="text-xs text-muted-foreground">{item.description}</span>
                  </span>
                </button>
              );
            }
            return (
              <button
                type="button"
                key={item.user.id}
                className={baseCls}
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => {
                  setHighlight(idx);
                  pickActive();
                }}
                data-testid={`mention-option-user-${item.user.id}`}
              >
                <Avatar className="h-7 w-7">
                  {item.user.profileImageUrl ? (
                    <AvatarImage src={item.user.profileImageUrl} />
                  ) : null}
                  <AvatarFallback className="text-[10px]">
                    {initials(item.user)}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate font-medium">{fullName(item.user)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Renders a string containing `@[Display](mention:token)` markers as text
// with bold/colored chips for each mention. Plain text remains untouched.
const MENTION_RE = /@\[([^\]]+)\]\(mention:([^)]+)\)/g;

export function MentionText({ text, className }: { text: string | null | undefined; className?: string }) {
  if (!text) return null;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(MENTION_RE);
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <span
        key={`mention-${key++}`}
        className="inline rounded px-1 font-semibold text-primary bg-primary/10"
        data-testid={`mention-chip-${m[2]}`}
      >
        @{m[1]}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <span className={className}>{parts}</span>;
}

// Strip mention markdown to plain readable text (for previews / listings).
export function stripMentionMarkdown(text: string | null | undefined): string {
  if (!text) return "";
  return text.replace(MENTION_RE, (_, display) => `@${display}`);
}
