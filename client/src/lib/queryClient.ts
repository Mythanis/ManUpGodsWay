import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<any> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  if (!res.ok) {
    const errorText = await res.text();
    if (res.status === 401) {
      // Redirect to login on unauthorized
      window.location.href = "/api/login";
      throw new Error("Unauthorized - redirecting to login");
    }
    throw new Error(`${res.status}: ${errorText || res.statusText}`);
  }

  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return await res.json();
  }
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Handle queryKey construction properly
    // First element should always be the base URL path
    // Subsequent string elements get joined with "/"
    // Objects are ignored for URL construction (they're cache parameters)
    const urlParts = [];
    for (const part of queryKey) {
      if (typeof part === "string") {
        urlParts.push(part);
      }
    }
    
    // Join with "/" but avoid double slashes
    let url = urlParts[0] || "";
    for (let i = 1; i < urlParts.length; i++) {
      const part = urlParts[i];
      if (!url.endsWith("/") && !part.startsWith("/")) {
        url += "/";
      }
      url += part;
    }
    
    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
