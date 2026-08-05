// TODO: implement data-fetching hook (e.g. via React Query) around features/jobs/api.
export function useJobListings() {
  return {
    data: [],
    isLoading: false,
  };
}
