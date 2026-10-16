import { MutationCache, QueryClient } from "@tanstack/react-query"
import { extractApiError } from "../api/client"
import { showToast } from "../components/ui/Toast"

export const queryClient = new QueryClient({
  // A save that fails on a screen without its own onError would otherwise fail
  // silently — and with payload encryption the Network tab can't show why — so
  // show the server's reason ("Pan: PAN looks like ABCDE1234F.") as a toast.
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.options.onError || mutation.meta?.silent) return
      showToast(extractApiError(error, "Could not save. Please try again."), "error")
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
