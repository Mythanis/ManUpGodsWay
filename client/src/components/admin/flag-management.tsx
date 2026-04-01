import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ContentFlag {
  id: string;
  reporterId: string;
  contentType: string;
  contentId: string;
  reason: string;
  description: string | null;
  status: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  contentUrl: string;
  reporter: {
    firstName: string | null;
    lastName: string | null;
  };
}

const REASON_LABELS: Record<string, string> = {
  inappropriate: "Inappropriate Content",
  spam: "Spam",
  harassment: "Harassment",
  offensive: "Offensive Language",
  other: "Other",
};

export default function FlagManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  const { data: flags = [], isLoading } = useQuery<ContentFlag[]>({
    queryKey: ["/api/admin/flags"],
  });

  const updateFlagMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/flags/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/flags"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update flag",
        variant: "destructive",
      });
    },
  });

  const handlePendingRowClick = (flag: ContentFlag) => {
    // Clicking the row sets status to in_review and opens the content
    updateFlagMutation.mutate({ id: flag.id, status: "in_review" });
    window.open(flag.contentUrl, "_blank");
  };

  const handleViewInReview = (flag: ContentFlag) => {
    window.open(flag.contentUrl, "_blank");
  };

  const handleComplete = (e: React.MouseEvent, flag: ContentFlag) => {
    e.stopPropagation();
    setUpdatingIds((prev) => new Set(prev).add(flag.id));
    updateFlagMutation.mutate(
      { id: flag.id, status: "completed" },
      {
        onSettled: () => {
          setUpdatingIds((prev) => {
            const next = new Set(prev);
            next.delete(flag.id);
            return next;
          });
        },
        onSuccess: () => {
          toast({
            title: "Flag Completed",
            description: "Flag has been marked as completed",
          });
        },
      }
    );
  };

  const pending = flags.filter((f) => f.status === "pending" || f.status === null);
  const inReview = flags.filter((f) => f.status === "in_review");
  const completed = flags.filter(
    (f) => f.status === "completed" || f.status === "resolved" || f.status === "dismissed"
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  function FlagBadges({ flag, dim = false }: { flag: ContentFlag; dim?: boolean }) {
    return (
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <Badge
          variant="outline"
          className={`text-xs font-semibold capitalize ${dim ? "opacity-50" : ""}`}
        >
          {flag.contentType}
        </Badge>
        <Badge
          variant="outline"
          className={`text-xs font-semibold ${
            dim
              ? "opacity-50"
              : flag.reason === "harassment" || flag.reason === "inappropriate"
              ? "bg-red-100 text-red-700 border-red-200"
              : flag.reason === "spam"
              ? "bg-yellow-100 text-yellow-700 border-yellow-200"
              : "bg-gray-100 text-gray-700 border-gray-200"
          }`}
        >
          {REASON_LABELS[flag.reason] ?? flag.reason}
        </Badge>
        <span className={`text-xs text-gray-400 ${dim ? "opacity-60" : ""}`}>
          {flag.createdAt
            ? formatDistanceToNow(new Date(flag.createdAt), { addSuffix: true })
            : ""}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Awaiting Review — entire row is clickable */}
      <Card className="border-2 border-red-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold text-red-700">
            <AlertTriangle className="h-5 w-5" />
            Awaiting Review
            {pending.length > 0 && (
              <Badge className="bg-red-600 text-white text-xs ml-1">
                {pending.length}
              </Badge>
            )}
          </CardTitle>
          {pending.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              Click a row to open the flagged content and begin review
            </p>
          )}
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-gray-400 italic text-center py-4">
              No flags awaiting review
            </p>
          ) : (
            <div className="space-y-2">
              {pending.map((flag) => (
                <div
                  key={flag.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handlePendingRowClick(flag)}
                  onKeyDown={(e) => e.key === "Enter" && handlePendingRowClick(flag)}
                  className="flex items-start justify-between gap-3 p-3 rounded-lg border border-red-200 bg-white hover:bg-red-50 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
                >
                  <div className="flex-1 min-w-0">
                    <FlagBadges flag={flag} />
                    <p className="text-xs text-gray-500 truncate">
                      Reported by:{" "}
                      <span className="font-medium text-gray-700">
                        {flag.reporter?.firstName && flag.reporter?.lastName
                          ? `${flag.reporter.firstName} ${flag.reporter.lastName}`
                          : "Unknown"}
                      </span>
                    </p>
                    {flag.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 italic">
                        "{flag.description}"
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700 text-white flex-shrink-0"
                    onClick={(e) => handleComplete(e, flag)}
                    disabled={updatingIds.has(flag.id)}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Complete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* In Review */}
      <Card className="border-2 border-yellow-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold text-yellow-700">
            <Clock className="h-5 w-5" />
            In Review
            {inReview.length > 0 && (
              <Badge className="bg-yellow-500 text-white text-xs ml-1">
                {inReview.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {inReview.length === 0 ? (
            <p className="text-sm text-gray-400 italic text-center py-4">
              No flags currently being reviewed
            </p>
          ) : (
            <div className="space-y-2">
              {inReview.map((flag) => (
                <div
                  key={flag.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-lg border border-yellow-200 bg-yellow-50"
                >
                  <div className="flex-1 min-w-0">
                    <FlagBadges flag={flag} />
                    <p className="text-xs text-gray-500 truncate">
                      Reported by:{" "}
                      <span className="font-medium text-gray-700">
                        {flag.reporter?.firstName && flag.reporter?.lastName
                          ? `${flag.reporter.firstName} ${flag.reporter.lastName}`
                          : "Unknown"}
                      </span>
                    </p>
                    {flag.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 italic">
                        "{flag.description}"
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                      onClick={() => handleViewInReview(flag)}
                    >
                      View
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700 text-white"
                      onClick={(e) => handleComplete(e, flag)}
                      disabled={updatingIds.has(flag.id)}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Complete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completed */}
      <Card className="border-2 border-green-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold text-green-700">
            <CheckCircle className="h-5 w-5" />
            Completed
            {completed.length > 0 && (
              <Badge className="bg-green-600 text-white text-xs ml-1">
                {completed.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {completed.length === 0 ? (
            <p className="text-sm text-gray-400 italic text-center py-4">
              No completed flags
            </p>
          ) : (
            <div className="space-y-2">
              {completed.map((flag) => (
                <div
                  key={flag.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50"
                >
                  <div className="flex-1 min-w-0">
                    <FlagBadges flag={flag} dim />
                    <p className="text-xs text-gray-400 truncate">
                      Reported by:{" "}
                      {flag.reporter?.firstName && flag.reporter?.lastName
                        ? `${flag.reporter.firstName} ${flag.reporter.lastName}`
                        : "Unknown"}
                    </p>
                  </div>
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
