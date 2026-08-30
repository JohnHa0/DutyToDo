import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Timeline, Tag, Typography, Segmented, Drawer, Descriptions, Form, Select, Button, message, Space, Input } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined, FileTextOutlined } from '@ant-design/icons';
import { fetchNotifications, updateNotification } from '../api';
import type { Notification } from '../api';
import dayjs from 'dayjs';
import './Dashboard.css';

const { Text } = Typography;
const { Option } = Select;

const Dashboard: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [sortType, setSortType] = useState<string>('deadline');
  
  // Drawer State
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Notification | null>(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    try {
      const res = await fetchNotifications();
      setNotifications(res);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const today = dayjs().format('YYYY-MM-DD');
  
  const urgentItems = notifications.filter(n => n.priority === '紧急' || n.priority === '重要');
  const processingItems = notifications.filter(n => n.status === '正在办理');
  const completedToday = notifications.filter(n => n.status === '已办结' && dayjs(n.updated_at || n.received_time).format('YYYY-MM-DD') === today);
  const pendingItems = notifications.filter(n => n.status === '待办理');

  const getFilteredItems = (baseList: Notification[]) => {
    let list = baseList;
    if (filterStatus === 'urgent') list = urgentItems;
    else if (filterStatus === 'processing') list = processingItems;
    else if (filterStatus === 'completed') list = completedToday;
    else if (filterStatus === 'pending') list = pendingItems;

    // Sorting
    return list.sort((a, b) => {
      if (sortType === 'deadline') {
        if (!a.event_time) return 1;
        if (!b.event_time) return -1;
        return dayjs(a.event_time).valueOf() - dayjs(b.event_time).valueOf();
      } else {
        if (!a.received_time) return 1;
        if (!b.received_time) return -1;
        return dayjs(b.received_time).valueOf() - dayjs(a.received_time).valueOf();
      }
    });
  };

  const handleCardClick = (filterType: string | null) => {
    setFilterStatus(filterStatus === filterType ? null : filterType);
  };

  const openDrawer = (item: Notification) => {
    setSelectedItem(item);
    form.setFieldsValue({
      status: item.status,
      priority: item.priority,
      routed_leaders: item.routed_leaders
    });
    setDrawerVisible(true);
  };

  const handleDrawerSave = async () => {
    try {
      const values = await form.validateFields();
      await updateNotification(selectedItem!.id!, values);
      message.success('更新成功');
      setDrawerVisible(false);
      loadData();
    } catch (e) {
      message.error('更新失败');
    }
  };

  const renderTimelineItem = (item: Notification) => {
    let color = 'blue';
    if (item.priority === '紧急') color = 'red';
    if (item.status === '已办结') color = 'green';
    
    return (
      <Timeline.Item color={color} key={item.id}>
        <div style={{ marginBottom: 4 }}>
          <Text strong style={{ fontSize: 16, cursor: 'pointer', color: '#1890ff' }} onClick={() => openDrawer(item)}>
            {item.title}
          </Text>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', color: '#888' }}>
          <Tag color={color === 'red' ? 'error' : 'default'}>{item.priority}</Tag>
          <span>发件: {item.sender_dept || '未知'}</span>
          <span>截止: {item.event_time ? dayjs(item.event_time).format('MM-DD HH:mm') : '无'}</span>
        </div>
      </Timeline.Item>
    );
  };

  const displayItems = getFilteredItems(filterStatus ? notifications : pendingItems);

  return (
    <div className="dashboard-container">
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card bordered={false} className={`stat-card ${filterStatus === 'urgent' ? 'active' : ''}`} style={{ borderLeft: '4px solid #ff4d4f' }} onClick={() => handleCardClick('urgent')}>
            <Statistic title="🔥 重点关注 (紧急/重要)" value={urgentItems.length} valueStyle={{ color: '#ff4d4f' }} prefix={<ExclamationCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} className={`stat-card ${filterStatus === 'processing' ? 'active' : ''}`} style={{ borderLeft: '4px solid #1890ff' }} onClick={() => handleCardClick('processing')}>
            <Statistic title="⏳ 正在办理" value={processingItems.length} valueStyle={{ color: '#1890ff' }} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} className={`stat-card ${filterStatus === 'completed' ? 'active' : ''}`} style={{ borderLeft: '4px solid #52c41a' }} onClick={() => handleCardClick('completed')}>
            <Statistic title="✅ 今日已办结" value={completedToday.length} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} className={`stat-card ${filterStatus === 'pending' ? 'active' : ''}`} style={{ borderLeft: '4px solid #faad14' }} onClick={() => handleCardClick('pending')}>
            <Statistic title="📅 待办理/遗留" value={pendingItems.length} valueStyle={{ color: '#faad14' }} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card 
        title={filterStatus ? "过滤结果" : "待处理项"}
        bordered={false} 
        className="shadow-sm glass-card"
        extra={
          <Segmented 
            options={[
              { label: '按截止时间', value: 'deadline' },
              { label: '按接收时间', value: 'received' }
            ]}
            value={sortType}
            onChange={(val) => setSortType(val as string)}
          />
        }
      >
        <div className="timeline-container">
          <Timeline mode="left">
            {displayItems.length > 0 ? displayItems.map(renderTimelineItem) : <div style={{ color: '#999', padding: 20 }}>暂无数据</div>}
          </Timeline>
          <div className="fade-mask" />
        </div>
      </Card>

      <Drawer
        title="通知处理快速预览"
        width={500}
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        extra={
          <Space>
            <Button onClick={() => setDrawerVisible(false)}>取消</Button>
            <Button type="primary" onClick={handleDrawerSave}>保存更新</Button>
          </Space>
        }
      >
        {selectedItem && (
          <div>
            <Descriptions title="通知详情" column={1} bordered size="small" style={{ marginBottom: 24 }}>
              <Descriptions.Item label="标题">{selectedItem.title}</Descriptions.Item>
              <Descriptions.Item label="发件部门">{selectedItem.sender_dept}</Descriptions.Item>
              <Descriptions.Item label="联系人">{selectedItem.contact_person}</Descriptions.Item>
              <Descriptions.Item label="截止时间">{selectedItem.event_time ? dayjs(selectedItem.event_time).format('YYYY-MM-DD HH:mm') : '无'}</Descriptions.Item>
              <Descriptions.Item label="接收时间">{dayjs(selectedItem.received_time).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
            </Descriptions>
            
            <Card size="small" title="原文内容" style={{ marginBottom: 24, background: '#f5f5f5' }}>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '13px' }}>
                {selectedItem.raw_text || '无原文记录'}
              </pre>
            </Card>

            <Form layout="vertical" form={form}>
              <Form.Item name="status" label="办理状态">
                <Select>
                  <Option value="待办理">待办理</Option>
                  <Option value="正在办理">正在办理</Option>
                  <Option value="已办结">已办结</Option>
                </Select>
              </Form.Item>
              <Form.Item name="priority" label="重要程度">
                <Select>
                  <Option value="普通">普通</Option>
                  <Option value="重要">重要</Option>
                  <Option value="紧急">紧急</Option>
                </Select>
              </Form.Item>
              <Form.Item name="routed_leaders" label="流转领导记录">
                <Input placeholder="输入已流转给哪位领导" />
              </Form.Item>
            </Form>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default Dashboard;
