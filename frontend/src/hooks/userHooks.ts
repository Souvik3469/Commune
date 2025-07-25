import { useQuery } from "@tanstack/react-query";
import { myDetails, searchUsers } from "../api/user";

export const useMyDetails = () =>
  useQuery({
    queryKey: ["myDetails"],
    queryFn: async () => {
      const user = await myDetails();
      return user;
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

export const useUserSearch = (query: string) => {
  return useQuery({
    queryKey: ["user-search", query],
    queryFn: () => searchUsers(query),
    enabled: !!query,
  });
};
