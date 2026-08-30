import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Input, Select, Space, Row, Col, DatePicker, message, Popconfirm } from 'antd';
import { SearchOutlined, DownloadOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { fetchNotifications, deleteNotification, Notification } from '../api';
import dayjs from 'dayjs';

const { Option } = Select;
const { RangePicker } = DatePicker;

const NotificationList: React.FC = () => {
  const [data, setData] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (searchText) filters.search = searchText;
      if (statusFilter) filters.status = statusFilter;
      
      const res = await fetchNotifications(filters);
      setData(res);
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleDelete = async (id: number) => {
    try {
      await deleteNotification(id);
      message.success('删除成功');
      loadData();
    } catch (e) {
      message.error('删除失败');
    }
  };

  const columns = [
    {
      title: '通知主体',
      dataIndex: 'title',
      key: 'title',
      width: '25%',
    },
    {
      title: '发件部门',
      dataIndex: 'sender_dept',
      key: 'sender_dept',
    },
    {
      title: '办理状态',
      key: 'status',
      dataIndex: 'status',
      render: (status: string) => {
        let color = status === '已办结' ? 'green' : status === '正在办理' ? 'blue' : 'orange';
        return <Tag color={color}>{status}</Tag>;
      },
    },
    {
      title: '重要程度',
      key: 'priority',
      dataIndex: 'priority',
      render: (priority: string) => {
        let color = priority === '紧急' ? 'red' : priority === '重要' ? 'gold' : 'default';
        return <Tag color={color}>{priority}</Tag>;
      },
    },
    {
      title: '事件时间',
      dataIndex: 'event_time',
      key: 'event_time',
      render: (text: string) => text ? dayjs(text).format('MM-DD HH:mm') : '-',
    },
    {
      title: '获取时间',
      dataIndex: 'received_time',
      key: 'received_time',
      render: (text: string) => text ? dayjs(text).format('MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Notification) => (
        <Space size="middle">
          <Button type="link" icon={<EditOutlined />} size="small">编辑</Button>
          <Popconfirm title="确定删除?" onConfirm={() => handleDelete(record.id!)}>
            <Button type="link" danger icon={<DeleteOutlined />} size="small">删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Input 
            placeholder="搜索标题或内容..." 
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            onPressEnter={loadData}
            suffix={<SearchOutlined onClick={loadData} style={{ cursor: 'pointer' }} />}
          />
        </Col>
        <Col span={4}>
          <Select placeholder="办理状态" style={{ width: '100%' }} allowClear onChange={setStatusFilter}>
            <Option value="待办理">待办理</Option>
            <Option value="正在办理">正在办理</Option>
            <Option value="已办结">已办结</Option>
          </Select>
        </Col>
        <Col span={6}>
           <RangePicker style={{ width: '100%' }} />
        </Col>
        <Col span={6} style={{ textAlign: 'right' }}>
          <Button type="primary" icon={<DownloadOutlined />}>导出 Excel</Button>
        </Col>
      </Row>
      <Table 
        columns={columns} 
        dataSource={data} 
        rowKey="id" 
        loading={loading}
        pagination={{ pageSize: 15 }}
      />
    </div>
  );
};

export default NotificationList;
