import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export const clientFavoritesQueryKey = ["/api/client/favorites"];

export type ClientFavorite = {
  id: string;
  talentId: string;
  createdAt?: string;
};

async function loadFavorites(): Promise<ClientFavorite[]> {
  const response = await apiRequest("GET", "/api/client/favorites");
  if (!response.ok) throw new Error("Failed to load favorites");
  const body = await response.json();
  return Array.isArray(body) ? body : (body.favorites ?? []);
}

export function useClientFavorites(enabled: boolean) {
  const queryClient = useQueryClient();
  const query = useQuery<ClientFavorite[]>({
    queryKey: clientFavoritesQueryKey,
    queryFn: loadFavorites,
    enabled,
    staleTime: 30_000,
  });

  const toggle = useMutation({
    mutationFn: async ({
      talentUserId,
      isFavorited,
    }: {
      talentUserId: string;
      isFavorited: boolean;
    }) => {
      const response = isFavorited
        ? await apiRequest("DELETE", `/api/client/favorites/${encodeURIComponent(talentUserId)}`)
        : await apiRequest("POST", "/api/client/favorites", { talentUserId });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || body.error || "Could not update favorite");
      }
      return { talentUserId, isFavorited };
    },
    onMutate: async ({ talentUserId, isFavorited }) => {
      await queryClient.cancelQueries({ queryKey: clientFavoritesQueryKey });
      const previous = queryClient.getQueryData<ClientFavorite[]>(clientFavoritesQueryKey);
      queryClient.setQueryData<ClientFavorite[]>(clientFavoritesQueryKey, (current = []) =>
        isFavorited
          ? current.filter((favorite) => favorite.talentId !== talentUserId)
          : current.some((favorite) => favorite.talentId === talentUserId)
            ? current
            : [{ id: `optimistic-${talentUserId}`, talentId: talentUserId }, ...current],
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(clientFavoritesQueryKey, context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: clientFavoritesQueryKey });
    },
  });

  return {
    ...query,
    favorites: query.data ?? [],
    toggle,
  };
}