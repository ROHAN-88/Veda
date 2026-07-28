import { useMutation, useQueryClient } from '@tanstack/react-query';
import { transferApi, type TransferDocument } from '../api/transfer';

/** Import a transfer document as a NEW project owned by the caller, then refresh
 *  the project list. */
export function useImportProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (doc: TransferDocument) => transferApi.import(doc),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });
}
