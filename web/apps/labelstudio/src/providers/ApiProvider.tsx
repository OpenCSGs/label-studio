import {
  createContext,
  forwardRef,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ErrorWrapper } from "../components/Error/Error";
import { modal } from "../components/Modal/Modal";
import { API_CONFIG } from "../config/ApiConfig";
import { type ApiParams, APIProxy } from "@humansignal/core/lib/api-proxy";
import { absoluteURL, isDefined } from "../utils/helpers";
import { FF_IMPROVE_GLOBAL_ERROR_MESSAGES, isFF } from "../utils/feature-flags";
import type { ApiResponse, WrappedResponse } from "@humansignal/core/lib/api-proxy/types";
import { ToastType, useToast } from "@humansignal/ui";
import { captureException } from "../config/Sentry";

export const IMPROVE_GLOBAL_ERROR_MESSAGES = isFF(FF_IMPROVE_GLOBAL_ERROR_MESSAGES);
// Duration for toast errors
export const API_ERROR_TOAST_DURATION = 10000;

export const API = new APIProxy({
  ...API_CONFIG,
  onRequestFinished(res) {
    if (res.status === 401) {
      location.href = "/";
    }
  },
});

export type ApiEndpoints = keyof typeof API.methods;

let apiLocked = false;

export type ApiCallOptions = {
  params?: any;
  suppressError?: boolean;
  errorFilter?: (response: ApiResponse) => boolean;
} & ApiParams;

export type ErrorDisplayMessage = (
  errorDetails: FormattedError,
  result: ApiResponse,
  showGlobalError?: boolean,
) => void;

export type ApiContextType = {
  api: typeof API;
  callApi: <T>(method: keyof (typeof API)["methods"], options?: ApiCallOptions) => Promise<WrappedResponse<T> | null>;
  handleError: (
    response: Response | ApiResponse,
    displayErrorMessage?: ErrorDisplayMessage,
    showGlobalError?: boolean,
  ) => Promise<boolean>;
  resetError: () => void;
  error: ApiResponse | null;
  showGlobalError: boolean;
  errorFormatter: (result: ApiResponse) => FormattedError;
  isValidMethod: (name: string) => boolean;
};

export type FormattedError = {
  title: string;
  message: string;
  stacktrace: string;
  version: string;
  validation: [string, string[]][];
  isShutdown: boolean;
};

export const ApiContext = createContext<ApiContextType | null>(null);
ApiContext.displayName = "ApiContext";

export const errorFormatter = (result: ApiResponse): FormattedError => {
  const response = "response" in result ? result.response : null;
  // we should not block app because of some network issue
  const isShutdown = false;

  return {
    isShutdown,
    title: result.error ? "Runtime error" : "Server error",
    message: response?.detail ?? result?.error,
    stacktrace: response?.exc_info ?? null,
    version: response?.version,
    validation: Object.entries<string[]>(response?.validation_errors ?? {}),
  };
};

const displayErrorModal: ErrorDisplayMessage = (errorDetails) => {
  const { isShutdown, title, message, stacktrace, ...formattedError } = errorDetails;

  modal({
    unique: "network-error",
    allowClose: !isShutdown,
    body: isShutdown ? (
      <ErrorWrapper
        possum={false}
        title={"Connection refused"}
        message={"Server not responding. Is it still running?"}
      />
    ) : (
      <ErrorWrapper
        {...formattedError}
        title={title}
        message={message}
        stacktrace={IMPROVE_GLOBAL_ERROR_MESSAGES ? undefined : stacktrace}
      />
    ),
    simple: true,
    style: { width: 680 },
  });
};

const handleError = async (
  response: Response | ApiResponse,
  displayErrorMessage?: ErrorDisplayMessage,
  showGlobalError = true,
) => {
  let result: ApiResponse = response as ApiResponse;

  if (response instanceof Response) {
    result = await API.generateError(response);
  }

  const errorDetails = errorFormatter(result);

  // Allow inline error handling
  if (!showGlobalError) {
    return errorDetails.isShutdown;
  }

  if (displayErrorMessage) {
    displayErrorMessage(errorDetails, result);
  } else {
    displayErrorModal(errorDetails, result);
  }

  return errorDetails.isShutdown;
};

const handleGlobalErrorMessage = (result?: ApiResponse, errorFilter?: (result: ApiResponse) => boolean) => {
  return result?.error && (!isDefined(errorFilter) || errorFilter(result) === false);
};

export const ApiProvider = forwardRef<ApiContextType, PropsWithChildren<any>>(({ children }, ref) => {
  const [error, setError] = useState<ApiResponse | null>(null);
  const toast = useToast();

  const resetError = () => setError(null);

  const callApi = useCallback(
    async <T,>(
      method: keyof (typeof API)["methods"],
      { params = {}, errorFilter, suppressError, ...rest }: ApiCallOptions = {},
    ): Promise<WrappedResponse<T> | null> => {
      if (apiLocked) return null;

      setError(null);

      const result = await API.invoke(method, params, rest);
      const shouldHandleGlobalErrorMessage = handleGlobalErrorMessage(result, errorFilter);

      // If the error is due to a 404 and we are not handling it inline, we need to redirect to a working page
      // and show a global error message of the resource not being found
      if (
        result &&
        "status" in result &&
        (result.status === 401 ||
          (IMPROVE_GLOBAL_ERROR_MESSAGES && result.status === 404 && shouldHandleGlobalErrorMessage))
      ) {
        apiLocked = true;

        let redirectUrl = absoluteURL("/");

        if (result.status === 404) {
          // If coming from projects or a labelling page, redirect to projects
          if (location.pathname.startsWith("/projects")) {
            redirectUrl = absoluteURL("/projects");
          }

          // Store the error message in sessionStorage to show after redirect
          sessionStorage.setItem("redirectMessage", "The page or resource you were looking for does not exist.");
        }

        // Perform immediate redirect
        location.href = redirectUrl;
        return null;
      }

      if (result?.error) {
        const status = result.$meta.status;
        const requestCancelled = !status;
        const requestAborted = result.error?.includes("aborted");
        const requestCompleted = !(requestCancelled || requestAborted);
        const containsValidationErrors =
          isDefined(result.response?.validation_errors) && Object.keys(result.response?.validation_errors).length > 0;

        let shouldShowGlobalError = shouldHandleGlobalErrorMessage && requestCompleted;

        if (IMPROVE_GLOBAL_ERROR_MESSAGES && requestCompleted) {
          // We only show toast errors for 4xx errors
          // Any non-4xx errors are logged to Sentry but there is nothing the user can do about them so don't show them to the user
          // 401 errors are handled above
          // If we end up with an empty status string from a cancelled request, don't show the error
          const is4xx = status.toString().startsWith("4");
          const stacktrace = result.response?.exc_info;
          const version = result.response?.version;

          shouldShowGlobalError = shouldShowGlobalError && is4xx;

          // Log non-4xx errors that are not aborted or cancelled requests, or any errors containing an api stacktrace to Sentry
          // So we know about them but don't show them to the user
          if ((!is4xx || stacktrace) && result.error) {
            captureException(new Error(result.error), {
              extra: {
                method,
                params,
                status,
                server_stacktrace: stacktrace,
                server_version: version,
              },
            });
          }
        }

        // Allow inline error handling
        if (suppressError !== true) {
          setError(result);
        }

        if (shouldShowGlobalError && suppressError !== true) {
          let displayErrorToast: ErrorDisplayMessage | undefined;

          // If there are no validation errors, show a toast error
          // Otherwise, show a modal error as previously handled
          if (IMPROVE_GLOBAL_ERROR_MESSAGES && !containsValidationErrors) {
            displayErrorToast = (errorDetails) => {
              toast?.show({
                message: `${errorDetails.title}: ${errorDetails.message}`,
                type: ToastType.error,
                duration: API_ERROR_TOAST_DURATION,
              });
            };
          }

          // Use global error handling
          const isShutdown = await handleError(result, displayErrorToast, contextValue.showGlobalError);
          apiLocked = apiLocked || isShutdown;

          return null;
        }
      }

      return result as WrappedResponse<T>;
    },
    [],
  );

  const contextValue: ApiContextType = useMemo(
    () => ({
      api: API,
      callApi,
      handleError,
      resetError,
      error,
      showGlobalError: true,
      errorFormatter,
      isValidMethod(name: string) {
        return API.isValidMethod(name);
      },
    }),
    [error, callApi],
  );

  useEffect(() => {
    if (ref && !(ref instanceof Function)) ref.current = contextValue;
  }, [ref]);

  // Check for redirect message in sessionStorage and display it
  useEffect(() => {
    const redirectMessage = sessionStorage.getItem("redirectMessage");
    if (redirectMessage) {
      toast?.show({
        message: redirectMessage,
        type: ToastType.error,
        duration: API_ERROR_TOAST_DURATION,
      });
      // Remove the message from sessionStorage to prevent showing it again
      sessionStorage.removeItem("redirectMessage");
    }
  }, [toast]);

  return <ApiContext.Provider value={contextValue}>{children}</ApiContext.Provider>;
});

export const useAPI = () => {
  return useContext(ApiContext)!;
};
