import React, { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import { Card, message } from 'antd';
import { fetchNotifications } from '../api';
import type { Notification } from '../api';
import './CalendarView.css'; // Custom styles for weekend highlighting and rounded corners

const CalendarView: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetchNotifications();
        const formattedEvents = res
          .filter((n: Notification) => n.event_time) // Only show items with a specific event time
          .map((n: Notification) => {
            let color = '#3788d8'; // Default blue
            if (n.status === '已办结') color = '#52c41a'; // Green
            else if (n.priority === '紧急') color = '#ff4d4f'; // Red
            else if (n.priority === '重要') color = '#faad14'; // Orange

            return {
              id: String(n.id),
              title: n.title,
              start: n.event_time,
              backgroundColor: color,
              borderColor: color,
              extendedProps: {
                priority: n.priority,
                status: n.status,
              }
            };
          });
        setEvents(formattedEvents);
      } catch (e) {
        message.error('加载日程失败');
      }
    };
    loadData();
  }, []);

  return (
    <Card bordered={false} className="glass-card calendar-wrapper">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek'
        }}
        events={events}
        locale="zh-cn"
        height={700}
        eventClick={(info) => {
          message.info(`通知: ${info.event.title} [${info.event.extendedProps.status}]`);
        }}
      />
    </Card>
  );
};

export default CalendarView;
