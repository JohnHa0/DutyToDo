import React, { useEffect, useState } from 'react';
import { Calendar, Badge, Card, message } from 'antd';
import type { Dayjs } from 'dayjs';
import { fetchNotifications, Notification } from '../api';
import dayjs from 'dayjs';

const CalendarView: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetchNotifications();
        setNotifications(res);
      } catch (e) {
        message.error('加载日程失败');
      }
    };
    loadData();
  }, []);

  const getListData = (value: Dayjs) => {
    const listData: any[] = [];
    const dateStr = value.format('YYYY-MM-DD');
    
    notifications.forEach(n => {
      if (n.event_time && dayjs(n.event_time).format('YYYY-MM-DD') === dateStr) {
        listData.push({
          type: n.status === '已办结' ? 'success' : n.priority === '紧急' ? 'error' : 'warning',
          content: n.title,
        });
      }
    });

    return listData || [];
  };

  const dateCellRender = (value: Dayjs) => {
    const listData = getListData(value);
    return (
      <ul className="events" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {listData.map((item, index) => (
          <li key={index}>
            <Badge status={item.type as any} text={item.content} style={{ fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} />
          </li>
        ))}
      </ul>
    );
  };

  const cellRender = (current: Dayjs, info: { type: string }) => {
    if (info.type === 'date') return dateCellRender(current);
    return info.originNode;
  };

  return (
    <Card bordered={false} className="shadow-sm">
      <Calendar cellRender={cellRender} />
    </Card>
  );
};

export default CalendarView;
