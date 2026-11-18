import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  InfiniteData,
  QueryClient,
} from "@tanstack/react-query";

import {
  markLiveNotificationsRead,
  mergeLiveNotifications,
  useIsNotificationSocketLive,
} from "@/lib/notifications/liveNotifications";

import { apiFetchClient } from "../client";
import type {
  ApiMessageResponse,
  ApiResponse,
  MarkNotificationReadResponse,
  UserNotification,
  UserNotificationsPage,
  UserNotificationsResponse,
} from "../types";

export const USER_NOTIFICATIONS_PATH =
  "/notification/notification-by-user";
export const MARK_ALL_NOTIFICATIONS_READ_PATH =
  "/notification/read-all";
export const USER_NOTIFICATIONS_QUERY_KEY = [
  "user-notifications",
] as const;

const NOTIFICATIONS_PAGE_SIZE = 10;

/** Polling is only a fallback for when the WebSocket is down. */
const FALLBACK_POLL_MS = 60_000;

type RawUserNotification = UserNotification & {
  user?: unknown;
};

type RawUserNotificationsResponse = ApiResponse<
  Omit<UserNotificationsPage, "content"> & {
    content: RawUserNotification[];
  }
>;

const buildUserNotificationsPath = (page: number) => {
  const params = new URLSearchParams();

  params.set("page", String(page));
  params.set("size", String(NOTIFICATIONS_PAGE_SIZE));

  return `${USER_NOTIFICATIONS_PATH}?${params.toString()}`;
};

const getMarkNotificationReadPath = (id: string) =>
  `/notification/${encodeURIComponent(id)}`;

const sanitizeNotificationsResponse = (
  response: RawUserNotificationsResponse,
): UserNotificationsResponse => ({
  ...response,
  data: {
    ...response.data,
    content: response.data.content.map((rawNotification) => {
      const { user, ...notification } = rawNotification;

      void user;

      return notification;
    }),
  },
});

const markLoadedNotificationRead = (
  queryClient: QueryClient,
  notificationId: string,
) => {
  queryClient.setQueryData<InfiniteData<UserNotificationsResponse>>(
    USER_NOTIFICATIONS_QUERY_KEY,
    (currentData) => {
      if (!currentData) {
        return currentData;
      }

      return {
        ...currentData,
        pages: currentData.pages.map((page) => ({
          ...page,
          data: {
            ...page.data,
            content: page.data.content.map((notification) =>
              notification.id === notificationId
                ? { ...notification, isRead: true }
                : notification,
            ),
          },
        })),
      };
    },
  );
};

export const upsertLoadedNotification = (
  queryClient: QueryClient,
  notification: UserNotification,
) => {
  queryClient.setQueryData<InfiniteData<UserNotificationsResponse>>(
    USER_NOTIFICATIONS_QUERY_KEY,
    (currentData) => {
      if (!currentData || currentData.pages.length === 0) {
        return currentData;
      }

      const alreadyLoaded = currentData.pages.some((page) =>
        page.data.content.some(
          (loadedNotification) =>
            loadedNotification.id === notification.id,
        ),
      );

      if (alreadyLoaded) {
        return currentData;
      }

      const [firstPage, ...remainingPages] = currentData.pages;

      return {
        ...currentData,
        pages: [
          {
            ...firstPage,
            data: {
              ...firstPage.data,
              content: [notification, ...firstPage.data.content],
              totalElements: firstPage.data.totalElements + 1,
            },
          },
          ...remainingPages,
        ],
      };
    },
  );
};

const markAllLoadedNotificationsRead = (
  queryClient: QueryClient,
) => {
  queryClient.setQueryData<InfiniteData<UserNotificationsResponse>>(
    USER_NOTIFICATIONS_QUERY_KEY,
    (currentData) => {
      if (!currentData) {
        return currentData;
      }

      return {
        ...currentData,
        pages: currentData.pages.map((page) => ({
          ...page,
          data: {
            ...page.data,
            content: page.data.content.map((notification) => ({
              ...notification,
              isRead: true,
            })),
          },
        })),
      };
    },
  );
};

export const useUserNotifications = () => {
  const isSocketLive = useIsNotificationSocketLive();

  return useInfiniteQuery<UserNotificationsResponse, Error>({
    queryKey: USER_NOTIFICATIONS_QUERY_KEY,
    queryFn: async ({ pageParam }) => {
      const response = await apiFetchClient.get<RawUserNotificationsResponse>(
        buildUserNotificationsPath(
          typeof pageParam === "number" ? pageParam : 0,
        ),
      );

      const page = sanitizeNotificationsResponse(response.data);

      // Keep live notifications the server's answer raced past.
      if (pageParam !== 0 && typeof pageParam === "number") {
        return page;
      }

      const { content, added } = mergeLiveNotifications(page.data.content);

      return added === 0
        ? page
        : { ...page, data: { ...page.data, content, totalElements: page.data.totalElements + added } };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.data.last ? undefined : lastPage.data.page + 1,
    refetchInterval: isSocketLive ? false : FALLBACK_POLL_MS,
    staleTime: 30_000,
  });
};

export const getUnreadNotificationsCount = (
  notificationsData?: InfiniteData<UserNotificationsResponse>,
) =>
  notificationsData?.pages.reduce(
    (totalUnreadCount, page) =>
      totalUnreadCount +
      page.data.content.filter((notification) => !notification.isRead)
        .length,
    0,
  ) ?? 0;

export const findLoadedNotification = (
  notificationsData: InfiniteData<UserNotificationsResponse> | undefined,
  notificationId: string,
) =>
  notificationsData?.pages
    .flatMap((page) => page.data.content)
    .find((notification) => notification.id === notificationId);

export const useUnreadNotificationsCount = () => {
  const notificationsQuery = useUserNotifications();

  return {
    unreadCount: getUnreadNotificationsCount(notificationsQuery.data),
  };
};

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();

  return useMutation<
    MarkNotificationReadResponse,
    Error,
    string,
    { previous?: InfiniteData<UserNotificationsResponse> }
  >({
    mutationFn: async (notificationId) => {
      const response =
        await apiFetchClient.patch<MarkNotificationReadResponse>(
          getMarkNotificationReadPath(notificationId),
        );

      return response.data;
    },
    // Show it read straight away; put it back if the server says no.
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: USER_NOTIFICATIONS_QUERY_KEY });
      const previous = queryClient.getQueryData<InfiniteData<UserNotificationsResponse>>(
        USER_NOTIFICATIONS_QUERY_KEY,
      );

      markLoadedNotificationRead(queryClient, notificationId);
      markLiveNotificationsRead(notificationId);

      return { previous };
    },
    onError: (_error, _notificationId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(USER_NOTIFICATIONS_QUERY_KEY, context.previous);
      }
    },
  });
};

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();

  return useMutation<ApiMessageResponse, Error>({
    mutationFn: async () => {
      const response = await apiFetchClient.patch<ApiMessageResponse>(
        MARK_ALL_NOTIFICATIONS_READ_PATH,
      );

      return response.data;
    },
    onSuccess: () => {
      markAllLoadedNotificationsRead(queryClient);
      markLiveNotificationsRead();
      void queryClient.invalidateQueries({
        queryKey: USER_NOTIFICATIONS_QUERY_KEY,
      });
    },
  });
};
