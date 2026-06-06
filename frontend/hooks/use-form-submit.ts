import { useState } from 'react';

interface UseFormSubmitOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export function useFormSubmit<T>(
  action: (...args: unknown[]) => Promise<T>,
  options: UseFormSubmitOptions<T> = {},
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (...args: unknown[]) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await action(...args);
      options.onSuccess?.(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
      options.onError?.(err instanceof Error ? err : new Error(message));
    } finally {
      setIsLoading(false);
    }
  };

  return { submit, isLoading, error };
}
