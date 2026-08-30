import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Input, Select, Space, Row, Col, DatePicker, message, Popconfirm, Drawer, Form, Descriptions, Popover, Checkbox } from 'antd';
import { SearchOutlined, DownloadOutlined, DeleteOutlined, EditOutlined, SettingOutlined } from '@ant-design/icons';
import { fetchNotifications, deleteNotification, updateNotification, fetchConfig } from '../api';
import type { Notification } from '../api';
import dayjs from 'dayjs';

const { Option } = Select;
const { RangePicker } = DatePicker;

const ALL_COLUMNS = [
  { key: 'title', label: '通知主体' },
  { key: 'sender_dept', label: '发件部门' },
  { key: 'status', label: '办理状态' },
  { key: 'priority', label: '重要程度' },
  { key: 'event_time', label: '事件时间' },
  { key: 'received_time', label: '接收时间' },
  { key: 'contact_person', label: '联系人' },
  { key: 'routed_leaders', label: '流转领导' },
  { key: 'tags', label: '业务标签' }
];

const NotificationList: React.FC = () => {
  const [data, setData] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Drawer
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Notification | null>(null);
  const [form] = Form.useForm();
  
  const [presetLeaders, setPresetLeaders] = useState<string[]>([]);
  
  // Column Visibility
  const [visibleColumns, setVisibleColumns] = useState<string[]>(['title', 'sender_dept', 'status', 'priority', 'event_time']);

  const loadData = async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (searchText) filters.search = searchText;
      if (statusFilter) filters.status = statusFilter;
      
      const res = await fetchNotifications(filters);
      setData(res);
      const leaders = await fetchConfig('preset_leaders');
      if (leaders) setPresetLeaders(leaders);
    } catch (e) {
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

  const handleExport = () => {
    import('xlsx').then(XLSX => {
      const exportData = data.map(item => ({
        '通知主体': item.title,
        '发件部门': item.sender_dept || '',
        '联系人': item.contact_person || '',
        '办理状态': item.status,
        '重要程度': item.priority,
        '事件时间': item.event_time ? dayjs(item.event_time).format('YYYY-MM-DD HH:mm') : '',
        '获取时间': item.received_time ? dayjs(item.received_time).format('YYYY-MM-DD HH:mm') : '',
        '流转领导': item.routed_leaders || '',
        '部门负责人': item.dept_heads || '',
        '标签': item.tags || ''
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "通知台账");
      XLSX.writeFile(wb, `值班台账_${dayjs().format('YYYYMMDD')}.xlsx`);
    });
  };

  const openDrawer = (item: Notification) => {
    setSelectedItem(item);
    form.setFieldsValue({
      title: item.title,
      raw_text: item.raw_text,
      status: item.status,
      priority: item.priority,
      event_time: item.event_time ? dayjs(item.event_time) : null,
      routed_leaders: item.routed_leaders ? item.routed_leaders.split(',') : []
    });
    setDrawerVisible(true);
  };

  const handleDrawerSave = async () => {
    try {
      const values = await form.validateFields();
      
      const payload = {
        ...values,
        event_time: values.event_time ? values.event_time.format('YYYY-MM-DD HH:mm:ss') : null,
        routed_leaders: Array.isArray(values.routed_leaders) ? values.routed_leaders.join(',') : values.routed_leaders
      };
      
      await updateNotification(selectedItem!.id!, payload);
      message.success('更新成功');
      setDrawerVisible(false);
      loadData();
    } catch (e) {
      message.error('更新失败');
    }
  };

  const columnRenderers: Record<string, any> = {
    title: { 
      title: '通知主体', 
      dataIndex: 'title', 
      width: '25%', 
      render: (text: string, record: Notification) => (
        <a onClick={() => openDrawer(record)}>{text}</a>
      )
    },
    sender_dept: { title: '发件部门', dataIndex: 'sender_dept', sorter: (a: any, b: any) => a.sender_dept?.localeCompare(b.sender_dept) },
    status: {
      title: '办理状态',
      dataIndex: 'status',
      render: (status: string) => {
        let color = status === '已办结' ? 'green' : status === '正在办理' ? 'blue' : 'orange';
        return <Tag color={color}>{status}</Tag>;
      },
      sorter: (a: any, b: any) => a.status.localeCompare(b.status)
    },
    priority: {
      title: '重要程度',
      dataIndex: 'priority',
      render: (priority: string) => {
        let color = priority === '紧急' ? 'red' : priority === '重要' ? 'gold' : 'default';
        return <Tag color={color}>{priority}</Tag>;
      },
      sorter: (a: any, b: any) => a.priority.localeCompare(b.priority)
    },
    event_time: {
      title: '事件时间',
      dataIndex: 'event_time',
      render: (text: string) => text ? dayjs(text).format('MM-DD HH:mm') : '-',
      sorter: (a: any, b: any) => (a.event_time ? dayjs(a.event_time).valueOf() : 0) - (b.event_time ? dayjs(b.event_time).valueOf() : 0)
    },
    received_time: {
      title: '接收时间',
      dataIndex: 'received_time',
      render: (text: string) => text ? dayjs(text).format('MM-DD HH:mm') : '-',
      sorter: (a: any, b: any) => dayjs(a.received_time).valueOf() - dayjs(b.received_time).valueOf()
    },
    contact_person: { title: '联系人', dataIndex: 'contact_person' },
    routed_leaders: { title: '流转领导', dataIndex: 'routed_leaders' },
    tags: { 
      title: '业务标签', 
      dataIndex: 'tags',
      render: (text: string) => text ? <Tag color="cyan">{text}</Tag> : '-'
    }
  };

  const columns = [
    ...visibleColumns.map(key => columnRenderers[key]),
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Notification) => (
        <Space size="middle">
          <Button type="link" icon={<EditOutlined />} size="small" onClick={() => openDrawer(record)}>处理</Button>
          <Popconfirm title="确定删除?" onConfirm={() => handleDelete(record.id!)}>
            <Button type="link" danger icon={<DeleteOutlined />} size="small">删除</Button>
          </Popconfirm>
        </Space>
      ),
    }
  ];

  const columnConfigContent = (
    <Checkbox.Group 
      value={visibleColumns} 
      onChange={(checkedValues) => setVisibleColumns(checkedValues as string[])}
      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      {ALL_COLUMNS.map(col => (
        <Checkbox key={col.key} value={col.key}>{col.label}</Checkbox>
      ))}
    </Checkbox.Group>
  );

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
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
        <Col span={8} style={{ textAlign: 'right' }}>
          <Space>
            <Popover content={columnConfigContent} title="显示字段配置" trigger="click" placement="bottomRight">
              <Button icon={<SettingOutlined />}>字段设置</Button>
            </Popover>
            <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>导出 Excel</Button>
          </Space>
        </Col>
      </Row>
      <Table 
        columns={columns} 
        dataSource={data} 
        rowKey="id" 
        loading={loading}
        pagination={{ pageSize: 15, showSizeChanger: true, showQuickJumper: true }}
      />

      <Drawer
        title="通知处理"
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
            
            <Form layout="vertical" form={form}>
              <Form.Item name="title" label="通知标题 (可编辑)" rules={[{ required: true }]}>
                <Input placeholder="输入标题" />
              </Form.Item>
              <Form.Item name="raw_text" label="原文内容 (可编辑)">
                <Input.TextArea rows={6} placeholder="输入原文内容" />
              </Form.Item>
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
              <Form.Item name="event_time" label="截止时间 (可修改)">
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="routed_leaders" label="流转领导记录 (支持多选)">
                <Select mode="tags" placeholder="选择或输入已流转给哪位领导" allowClear>
                  {presetLeaders.map(l => <Option key={l} value={l}>{l}</Option>)}
                </Select>
              </Form.Item>
            </Form>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default NotificationList;
