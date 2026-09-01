import React, { useEffect } from 'react';
import { fetchNotifications, fetchConfig } from '../api';
import { sendNotification, isPermissionGranted, requestPermission } from '@tauri-apps/api/notification';
import dayjs from 'dayjs';

const NotificationTracker: React.FC = () => {
  useEffect(() => {
    const checkReminders = async () => {
      try {
        const enabled = await fetchConfig('reminder_enabled');
        if (enabled === 'false') return;

        const advanceStr = await fetchConfig('reminder_advance_minutes');
        const advanceMinutes = advanceStr ? parseInt(advanceStr, 10) : 60; // Default 60 mins

        const notifications = await fetchNotifications();
        const pending = notifications.filter(
          n => n.status !== '已办结' && n.event_time
        );

        let permissionGranted = await isPermissionGranted();
        if (!permissionGranted) {
          const permission = await requestPermission();
          permissionGranted = permission === 'granted';
        }
        if (!permissionGranted) return;

        const now = dayjs();
        const remindedLog = JSON.parse(localStorage.getItem('duty_reminded_log') || '{}');
        let logUpdated = false;

        pending.forEach(n => {
          const eventTime = dayjs(n.event_time);
          const diffMinutes = eventTime.diff(now, 'minute');

          // Check for upcoming reminder
          if (diffMinutes > 0 && diffMinutes <= advanceMinutes) {
            const key = `${n.id}_upcoming`;
            if (!remindedLog[key]) {
              sendNotification({
                title: '待办即将到期提醒',
                body: `【${n.title}】将在 ${diffMinutes} 分钟后到期 (办理人: ${n.handler || '未指定'})`
              });
              remindedLog[key] = true;
              logUpdated = true;
            }
          }

          // Check for overdue reminder (only remind once when it just became overdue)
          if (diffMinutes <= 0 && diffMinutes > -1440) { // Overdue within last 24h
            const key = `${n.id}_overdue`;
            if (!remindedLog[key]) {
              sendNotification({
                title: '待办任务已逾期',
                body: `【${n.title}】已逾期，请尽快处理！`
              });
              remindedLog[key] = true;
              logUpdated = true;
            }
          }
        });

        if (logUpdated) {
          localStorage.setItem('duty_reminded_log', JSON.stringify(remindedLog));
        }
      } catch (e) {
        console.error('Reminder check failed', e);
      }
    };

    // Run immediately then every 1 minute
    checkReminders();
    const interval = setInterval(checkReminders, 60000);

    return () => clearInterval(interval);
  }, []);

  return null; // Silent background component
};

export default NotificationTracker;
