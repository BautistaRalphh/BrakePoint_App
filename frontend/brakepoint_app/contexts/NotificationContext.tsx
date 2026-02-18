"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";

interface Notification {
  id: string;
  videoName: string;
  success: boolean;
  data?: any;
  read: boolean;
  timestamp: number;
  processing?: boolean;
}

interface NotificationContextType {
  hydrated: boolean;

  notifications: Notification[];
  addNotification: (videoName: string, success: boolean, data?: any) => void;
  addProcessingNotification: (videoName: string) => string;
  completeProcessing: (id: string, success: boolean, data?: any) => void;
  removeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  clearAll: () => void;
  unreadCount: number;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

function safeParseNotifications(raw: string | null): Notification[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((n: any) => n && typeof n === "object" && !n.processing)
      .map((n: any) => ({
        id: String(n.id ?? crypto.randomUUID()),
        videoName: String(n.videoName ?? ""),
        success: Boolean(n.success),
        data: n.data,
        read: Boolean(n.read),
        timestamp: typeof n.timestamp === "number" ? n.timestamp : Date.now(),
        processing: Boolean(n.processing),
      }));
  } catch {
    return [];
  }
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("brakepoint_notifications");
    const loaded = safeParseNotifications(stored);
    setNotifications(loaded);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("brakepoint_notifications", JSON.stringify(notifications));
  }, [notifications, hydrated]);

  const addNotification = useCallback((videoName: string, success: boolean, data?: any) => {
    const now = Date.now();
    const newNotification: Notification = {
      id: crypto.randomUUID(),
      videoName,
      success,
      data,
      read: false,
      timestamp: now,
      processing: false,
    };

    setNotifications((prev) => [newNotification, ...prev]);
  }, []);

  const addProcessingNotification = useCallback((videoName: string) => {
    const now = Date.now();
    const id = crypto.randomUUID();

    const newNotification: Notification = {
      id,
      videoName,
      success: false,
      read: false,
      timestamp: now,
      processing: true,
    };

    setNotifications((prev) => [newNotification, ...prev]);
    return id;
  }, []);

  const completeProcessing = useCallback((id: string, success: boolean, data?: any) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, processing: false, success, data } : n)));
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => {
      const filtered = prev.filter((n) => n.id !== id);
      return filtered;
    });
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const value = useMemo<NotificationContextType>(
    () => ({
      hydrated,
      notifications,
      addNotification,
      addProcessingNotification,
      completeProcessing,
      removeNotification,
      markAsRead,
      clearAll,
      unreadCount,
    }),
    [hydrated, notifications, addNotification, addProcessingNotification, completeProcessing, removeNotification, markAsRead, clearAll, unreadCount],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
