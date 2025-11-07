'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface Notification {
  id: number;
  videoName: string;
  success: boolean;
  data?: any;
  read: boolean;
  timestamp: number;
  processing?: boolean; 
  progress?: number;    
  stage?: 'yolo' | 'mask-rcnn' | 'complete'; 
  yoloProgress?: number; 
  maskRcnnProgress?: number;  
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (videoName: string, success: boolean, data?: any) => void;
  addProcessingNotification: (videoName: string) => number;
  updateProgress: (id: number, progress: number) => void;
  updateStageProgress: (id: number, stage: 'yolo' | 'mask-rcnn', progress: number) => void;
  completeProcessing: (id: number, success: boolean, data?: any) => void;
  removeNotification: (id: number) => void;
  markAsRead: (id: number) => void;
  clearAll: () => void;
  unreadCount: number;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Load notifications from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('brakepoint_notifications');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Filter out any processing notifications from previous sessions
        const validNotifications = parsed.filter((n: Notification) => !n.processing);
        setNotifications(validNotifications);
      } catch (error) {
        console.error('Failed to load notifications:', error);
      }
    }
  }, []);

  // Save notifications to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('brakepoint_notifications', JSON.stringify(notifications));
  }, [notifications]);

  const addNotification = useCallback((videoName: string, success: boolean, data?: any) => {
    const newNotification: Notification = {
      id: Date.now(),
      videoName,
      success,
      data,
      read: false,
      timestamp: Date.now(),
      processing: false,
    };
    setNotifications(prev => {
      const updated = [newNotification, ...prev];
      return updated;
    });
  }, []);

  const addProcessingNotification = useCallback((videoName: string) => {
    const id = Date.now();
    const newNotification: Notification = {
      id,
      videoName,
      success: false,
      read: false,
      timestamp: Date.now(),
      processing: true,
      progress: 0,
      stage: 'yolo',
      yoloProgress: 0,
      maskRcnnProgress: 0,
    };
    setNotifications(prev => {
      const updated = [newNotification, ...prev];
      return updated;
    });
    return id;
  }, []);

  const updateProgress = useCallback((id: number, progress: number) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, progress: Math.min(100, Math.max(0, progress)) } : n))
    );
  }, []);

  const updateStageProgress = useCallback((id: number, stage: 'yolo' | 'mask-rcnn', progress: number) => {
    setNotifications(prev =>
      prev.map(n => {
        if (n.id === id) {
          const updates: Partial<Notification> = { stage };
          if (stage === 'yolo') {
            updates.yoloProgress = Math.min(100, Math.max(0, progress));
          } else if (stage === 'mask-rcnn') {
            updates.yoloProgress = 100;
            updates.maskRcnnProgress = Math.min(100, Math.max(0, progress));
          }
          return { ...n, ...updates };
        }
        return n;
      })
    );
  }, []);

  const completeProcessing = useCallback((id: number, success: boolean, data?: any) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { 
        ...n, 
        processing: false, 
        success, 
        data, 
        progress: 100,
        yoloProgress: 100,
        maskRcnnProgress: 100
      } : n))
    );
  }, []);

  const removeNotification = useCallback((id: number) => {
    setNotifications(prev => {
      const filtered = prev.filter(n => n.id !== id);
      return filtered;
    });
  }, []);

  const markAsRead = useCallback((id: number) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        addProcessingNotification,
        updateProgress,
        updateStageProgress,
        completeProcessing,
        removeNotification,
        markAsRead,
        clearAll,
        unreadCount,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
