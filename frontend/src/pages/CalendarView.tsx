import React, { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import zhCnLocale from '@fullcalendar/core/locales/zh-cn';
import { Card, message, Popover, Tag, Modal, Descriptions } from 'antd';
import { fetchNotifications } from '../api';
import type { Notification } from '../api';
import dayjs from 'dayjs';
import './CalendarView.css';

const CalendarView: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetchNotifications();
        const formattedEvents = res
          .filter((n: Notification) => n.event_time) // Only show items with a specific event time
          .map((n: Notification) => {
            let color = '#3788d8'; // Default blue
            
            if (n.tags && n.tags.trim().length > 0) {
              const firstTag = n.tags.split(',')[0].trim();
              if (firstTag) {
                // Generate consistent color based on string hash
                let hash = 0;
                for (let i = 0; i < firstTag.length; i++) {
                  hash = firstTag.charCodeAt(i) + ((hash << 5) - hash);
                }
                color = `hsl(${Math.abs(hash) % 360}, 75%, 45%)`;
              }
            } else if (n.status === '已办结') {
              color = '#52c41a'; // Green
            } else if (n.priority === '紧急') {
              color = '#ff4d4f'; // Red
            } else if (n.priority === '重要') {
              color = '#faad14'; // Orange
            }

            return {
              id: String(n.id),
              title: n.title,
              start: n.event_time,
              backgroundColor: color,
              borderColor: color,
              extendedProps: {
                priority: n.priority,
                status: n.status,
                sender_dept: n.sender_dept,
                handler: n.handler,
                contact_person: n.contact_person,
                raw_text: n.raw_text,
                tags: n.tags
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

  const renderEventContent = (eventInfo: any) => {
    const props = eventInfo.event.extendedProps;
    
    const popoverContent = (
      <div style={{ maxWidth: 300 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 8 }}>{eventInfo.event.title}</div>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
          {dayjs(eventInfo.event.start).format('YYYY-MM-DD HH:mm')}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
          <Tag color={props.status === '已办结' ? 'green' : 'orange'}>{props.status}</Tag>
          {props.priority !== '普通' && <Tag color="red">{props.priority}</Tag>}
        </div>
        <div style={{ fontSize: 13 }}>
          <div><strong>主办部门:</strong> {props.sender_dept || '-'}</div>
          <div><strong>联系人:</strong> {props.contact_person || '-'}</div>
          <div><strong>办理人:</strong> {props.handler || '-'}</div>
        </div>
      </div>
    );

    return (
      <Popover content={popoverContent} trigger="hover" placement="top" mouseEnterDelay={0.3}>
        <div className="calendar-event-content">
          <div className="calendar-event-dot" style={{ backgroundColor: '#fff' }} />
          <div className="calendar-event-title">{eventInfo.event.title}</div>
        </div>
      </Popover>
    );
  };

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
        locales={[zhCnLocale]}
        locale="zh-cn"
        firstDay={1}
        height={700}
        eventContent={renderEventContent}
        eventClick={(info) => {
          setSelectedEvent({
            title: info.event.title,
            start: info.event.start,
            ...info.event.extendedProps
          });
          setModalVisible(true);
        }}
      />

      <Modal
        title="日历日程详情"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={500}
      >
        {selectedEvent && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="通知标题">{selectedEvent.title}</Descriptions.Item>
            <Descriptions.Item label="事件时间">{dayjs(selectedEvent.start).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={selectedEvent.status === '已办结' ? 'green' : 'orange'}>{selectedEvent.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="重要程度">{selectedEvent.priority}</Descriptions.Item>
            <Descriptions.Item label="主办部门">{selectedEvent.sender_dept}</Descriptions.Item>
            <Descriptions.Item label="联系人">{selectedEvent.contact_person}</Descriptions.Item>
            <Descriptions.Item label="办理人">{selectedEvent.handler}</Descriptions.Item>
            <Descriptions.Item label="业务标签">{selectedEvent.tags}</Descriptions.Item>
            <Descriptions.Item label="通知原文">
              <div style={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto' }}>
                {selectedEvent.raw_text}
              </div>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </Card>
  );
};

export default CalendarView;
