import type { APIFullUser } from "../../types/User";

declare const useCurrentUser: () => {
  user: APIFullUser;
  fetch: () => Promise<void>;
  setQueryData?: (update: Partial<APIUserFull>) => void;
  isInProgress: boolean;
};
