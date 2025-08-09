// hooks/authHooks.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  sendOtp,
  verifyOtp,
  register,
  login,
  getCurrentUser,
  logout,
} from "../api/auth";

export const useRegister = () =>
  useMutation({
    mutationFn: (formData: FormData) => register(formData),
  });

export const useLogin = () =>
  useMutation({
    mutationFn: (data: { email: string; password: string }) => login(data),
  });

export const useCurrentUser = () =>
  useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const res = await getCurrentUser();
      return res.data.user;
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

export const useLogout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["currentUser"] });
    },
  });
};

export const useSendOtp = () =>
  useMutation({
    mutationFn: (email: string) => sendOtp(email),
  });

export const useVerifyOtp = () =>
  useMutation({
    mutationFn: ({ email, otp }: { email: string; otp: string }) =>
      verifyOtp(email, otp),
  });
