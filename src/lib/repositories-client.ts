export type CreateRepositoryPayload = {
  name: string;
  isPrivate: boolean;
};

export type CreateRepositoryResponse = {
  success?: boolean;
  url?: string;
  error?: string;
};

/** Create a new GitHub repository for the current authenticated user. */
export async function createRepository(
  payload: CreateRepositoryPayload,
): Promise<CreateRepositoryResponse> {
  const response = await fetch("/api/github/repositories", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: payload.name,
      private: payload.isPrivate,
    }),
  });

  const data = (await response.json()) as CreateRepositoryResponse;

  if (!response.ok) {
    return {
      error: data.error ?? "Failed to create repository.",
    };
  }

  return data;
}
