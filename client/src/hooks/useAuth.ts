import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/auth';
import type { User } from '../api/types';

interface Credentials {
  email: string;
  password: string;
}

export function useMe() {
  return useQuery<User | null>({
    queryKey: ['me'],
    queryFn: authApi.me,
    staleTime: 30_000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: Credentials) => authApi.login(email, password),
    onSuccess: (user) => {
      queryClient.setQueryData(['me'], user);
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: ({ email, password }: Credentials) => authApi.register(email, password),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      queryClient.setQueryData(['me'], null);
      queryClient.removeQueries({ queryKey: ['projects'] });
    },
  });
}
