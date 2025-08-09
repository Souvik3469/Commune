import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { myDetails, searchUsers, updateProfile } from "../api/user";

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

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => updateProfile(formData),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["myDetails"] });
    },
  });
};
