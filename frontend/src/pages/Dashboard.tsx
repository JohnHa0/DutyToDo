import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, List, Tag, Typography, Button } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined, FileTextOutlined } from '@ant-design/icons';
import { fetchNotifications, Notification } from '../api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const Dashboard: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const res = await fetchNotifications();
        setNotifications(res);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const today = dayjs().format('YYYY-MM-DD');
  
  // Basic filtering for today's dashboard
  const urgentItems = notifications.filter(n => n.priority === '紧急' || n.priority === '重要');
  const processingItems = notifications.filter(n => n.status === '正在办理');
  const completedToday = notifications.filter(n => n.status === '已办结' && dayjs(n.updated_at || n.received_time).format('YYYY-MM-DD') === today);
  const pendingItems = notifications.filter(n => n.status === '待办理');

  const renderListItem = (item: Notification) => (
    <List.Item
      actions={[<Button type="link" size="small">处理</Button>]}
    >
      <List.Item.Meta
        title={<span style={{ fontWeight: item.priority === '紧急' ? 'bold' : 'normal', color: item.priority === '紧急' ? 'red' : 'inherit' }}>{item.title}</span>}
        description={
          <div>
            <Tag color="blue">{item.sender_dept || '未知部门'}</Tag>
            <Text type="secondary">{item.event_time ? dayjs(item.event_time).format('MM-DD HH:mm') : '无具体时间'}</Text>
          </div>
        }
      />
    </List.Item>
  );

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card bordered={false} className="shadow-sm" style={{ borderLeft: '4px solid #ff4d4f' }}>
            <Statistic title="🔥 重点关注 (紧急/重要)" value={urgentItems.length} valueStyle={{ color: '#ff4d4f' }} prefix={<ExclamationCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} className="shadow-sm" style={{ borderLeft: '4px solid #1890ff' }}>
            <Statistic title="⏳ 正在办理" value={processingItems.length} valueStyle={{ color: '#1890ff' }} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} className="shadow-sm" style={{ borderLeft: '4px solid #52c41a' }}>
            <Statistic title="✅ 今日已办结" value={completedToday.length} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} className="shadow-sm" style={{ borderLeft: '4px solid #faad14' }}>
            <Statistic title="📅 待办理/遗留" value={pendingItems.length} valueStyle={{ color: '#faad14' }} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
      </Row>

      <Row gutter={24}>
        <Col span={12}>
          <Card title="需要跟进 / 流转中" bordered={false} className="shadow-sm" bodyStyle={{ padding: '0 24px' }}>
            <List
              itemLayout="horizontal"
              dataSource={processingItems.slice(0, 5)}
              renderItem={renderListItem}
              loading={loading}
              locale={{ emptyText: '太棒了，目前没有积压的办理项！' }}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="待处理项" bordered={false} className="shadow-sm" bodyStyle={{ padding: '0 24px' }}>
            <List
              itemLayout="horizontal"
              dataSource={pendingItems.slice(0, 5)}
              renderItem={renderListItem}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
