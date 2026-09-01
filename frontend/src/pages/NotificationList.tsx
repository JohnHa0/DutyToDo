import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Input, Select, Space, Row, Col, DatePicker, message, Popconfirm, Drawer, Form, Descriptions, Popover, Checkbox, Upload, Typography } from 'antd';
import { SearchOutlined, DownloadOutlined, DeleteOutlined, EditOutlined, SettingOutlined } from '@ant-design/icons';
import { fetchNotifications, deleteNotification, updateNotification, fetchConfig, uploadFile, openFile, downloadAttachment } from '../api';
import { save } from '@tauri-apps/api/dialog';
import { writeBinaryFile } from '@tauri-apps/api/fs';
import type { Notification } from '../api';
import dayjs from 'dayjs';

const { Option } = Select;
const { RangePicker } = DatePicker;

const ALL_COLUMNS = [
  { key: 'title', label: '通知标题' },
  { key: 'raw_text', label: '通知内容' },
  { key: 'sender_dept', label: '发件部门' },
  { key: 'status', label: '办理状态' },
  { key: 'priority', label: '重要程度' },
  { key: 'event_time', label: '事件时间' },
  { key: 'received_time', label: '接收时间' },
  { key: 'contact_person', label: '联系人' },
  { key: 'routed_leaders', label: '流转领导' },
  { key: 'handler', label: '办理人' },
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
  const [presetDepartments, setPresetDepartments] = useState<string[]>([]);
  const [presetTags, setPresetTags] = useState<{name: string; color: string}[]>([]);
  
  // Column Visibility
  const [visibleColumns, setVisibleColumns] = useState<string[]>(['title', 'raw_text', 'sender_dept', 'status', 'priority', 'event_time']);

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
      const depts = await fetchConfig('preset_departments');
      if (depts) setPresetDepartments(depts);
      const tags = await fetchConfig('preset_tags');
      if (tags) setPresetTags(tags);
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

  const handleExport = async () => {
    try {
      const XLSX = await import('xlsx');
      const exportData = data.map(item => ({
        '通知标题': item.title,
        '通知内容': item.raw_text || '',
        '发件部门': item.sender_dept || '',
        '联系人': item.contact_person || '',
        '办理状态': item.status,
        '重要程度': item.priority,
        '事件时间': item.event_time ? (dayjs(item.event_time).format('YYYY-MM-DD HH:mm') + (item.event_end ? ' ~ ' + dayjs(item.event_end).format('YYYY-MM-DD HH:mm') : '')) : '',
        '获取时间': item.received_time ? dayjs(item.received_time).format('YYYY-MM-DD HH:mm') : '',
        '流转领导': item.routed_leaders || '',
        '办理人': item.handler || '',
        '业务标签': item.tags || ''
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "通知台账");
      
      const u8 = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      
      const savePath = await save({
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
        defaultPath: `值班台账_${dayjs().format('YYYYMMDD')}.xlsx`
      });
      
      if (savePath) {
        await writeBinaryFile(savePath, new Uint8Array(u8));
        message.success('导出成功');
      }
    } catch (e: any) {
      message.error('导出失败: ' + e.message);
    }
  };

  const openDrawer = (item: Notification) => {
    setSelectedItem(item);
    form.setFieldsValue({
      title: item.title,
      sender_dept: item.sender_dept || '',
      contact_person: item.contact_person || '',
      tags: item.tags ? item.tags.split(',') : [],
      raw_text: item.raw_text,
      status: item.status,
      priority: item.priority,
      received_time: item.received_time ? dayjs(item.received_time) : null,
      event_time: item.event_time ? [
        dayjs(item.event_time),
        item.event_end ? dayjs(item.event_end) : dayjs(item.event_time)
      ] : null,
      routed_leaders: item.routed_leaders ? item.routed_leaders.split(',') : [],
      handler: item.handler || '',
      attachments: item.attachments ? (typeof item.attachments === 'string' ? JSON.parse(item.attachments) : item.attachments).map((f: any) => {
        let cleanUrl = f.url || '';
        if (cleanUrl.startsWith('http://127.0.0.1:8000')) {
          cleanUrl = cleanUrl.replace('http://127.0.0.1:8000', '');
        }
        return { ...f, status: 'done', url: cleanUrl };
      }) : []
    });
    setDrawerVisible(true);
  };

  const normFile = (e: any) => {
    if (Array.isArray(e)) return e;
    return e?.fileList;
  };

  const customUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;
    try {
      const buffer = await file.arrayBuffer();
      const path = await uploadFile(file.name, new Uint8Array(buffer));
      onSuccess({ url: path });
    } catch (e) {
      onError(e);
    }
  };
  
  const handlePreview = async (file: any) => {
    let path = file.response?.url || file.url;
    if (path) {
      try {
        await openFile(path);
      } catch (e: any) {
        message.error(e);
      }
    }
  };

  const handleDownload = async (file: any) => {
    let path = file.response?.url || file.url;
    if (path) {
      try {
        const saved = await downloadAttachment(path, file.name);
        if (saved) message.success('附件已另存为');
      } catch (e: any) {
        message.error('保存失败: ' + e);
      }
    }
  };

  const handleDrawerSave = async () => {
    try {
      const values = await form.validateFields();
      
      const payload = {
        ...values,
        sender_dept: values.sender_dept,
        contact_person: values.contact_person,
        tags: values.tags ? values.tags.join(',') : '',
        received_time: values.received_time ? values.received_time.format('YYYY-MM-DD HH:mm:ss') : undefined,
        event_time: (values.event_time && values.event_time[0]) ? values.event_time[0].format('YYYY-MM-DD HH:mm:ss') : null,
        event_end: (values.event_time && values.event_time[1]) ? values.event_time[1].format('YYYY-MM-DD HH:mm:ss') : null,
        routed_leaders: Array.isArray(values.routed_leaders) ? values.routed_leaders.join(',') : values.routed_leaders,
        handler: values.handler,
        attachments: values.attachments ? JSON.stringify(values.attachments.map((f: any) => {
          let cleanUrl = (f.response?.url || f.url) || '';
          if (cleanUrl.startsWith('http://127.0.0.1:8000')) {
            cleanUrl = cleanUrl.replace('http://127.0.0.1:8000', '');
          }
          return { uid: f.uid, name: f.name, url: cleanUrl };
        })) : null
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
      title: '通知标题', 
      dataIndex: 'title', 
      width: '20%', 
      render: (text: string, record: Notification) => (
        <a onClick={() => openDrawer(record)}>{text}</a>
      ),
      sorter: (a: any, b: any) => (a.title || '').localeCompare(b.title || '')
    },
    raw_text: {
      title: '通知内容',
      dataIndex: 'raw_text',
      width: '25%',
      render: (text: string) => <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }} title={text}>{text}</div>,
      sorter: (a: any, b: any) => (a.raw_text || '').localeCompare(b.raw_text || '')
    },
    sender_dept: { title: '发件部门', dataIndex: 'sender_dept', sorter: (a: any, b: any) => (a.sender_dept || '').localeCompare(b.sender_dept || '') },
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
      render: (text: string, record: any) => text ? (dayjs(text).format('MM-DD HH:mm') + (record.event_end ? ' ~ ' + dayjs(record.event_end).format('MM-DD HH:mm') : '')) : '-',
      sorter: (a: any, b: any) => (a.event_time ? dayjs(a.event_time).valueOf() : 0) - (b.event_time ? dayjs(b.event_time).valueOf() : 0)
    },
    received_time: {
      title: '接收时间',
      dataIndex: 'received_time',
      render: (text: string) => text ? dayjs(text).format('MM-DD HH:mm') : '-',
      sorter: (a: any, b: any) => dayjs(a.received_time).valueOf() - dayjs(b.received_time).valueOf()
    },
    contact_person: { title: '联系人', dataIndex: 'contact_person', sorter: (a: any, b: any) => (a.contact_person || '').localeCompare(b.contact_person || '') },
    routed_leaders: { title: '流转领导', dataIndex: 'routed_leaders', sorter: (a: any, b: any) => (a.routed_leaders || '').localeCompare(b.routed_leaders || '') },
    handler: { title: '办理人', dataIndex: 'handler', sorter: (a: any, b: any) => (a.handler || '').localeCompare(b.handler || '') },
    tags: { 
      title: '业务标签', 
      dataIndex: 'tags',
      render: (text: string) => text ? <Tag color="cyan">{text}</Tag> : '-',
      sorter: (a: any, b: any) => (a.tags || '').localeCompare(b.tags || '')
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
            <Typography.Text type="secondary" style={{ marginRight: 8 }}>
              共查询到 {data.length} 条记录
            </Typography.Text>
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
              <Descriptions.Item label="起止时间">{selectedItem.event_time ? (dayjs(selectedItem.event_time).format('YYYY-MM-DD HH:mm') + (selectedItem.event_end ? ' ~ ' + dayjs(selectedItem.event_end).format('YYYY-MM-DD HH:mm') : '')) : '无'}</Descriptions.Item>
              <Descriptions.Item label="接收时间">{dayjs(selectedItem.received_time).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
            </Descriptions>
            
            <Form layout="vertical" form={form}>
              <Form.Item name="title" label="通知标题 (可编辑)" rules={[{ required: true }]}>
                <Input placeholder="输入标题" />
              </Form.Item>
                            <Form.Item name="sender_dept" label="发件部门 (可修改)">
                <Select mode="tags" placeholder="选择或输入" allowClear>
                  {presetDepartments.map(dept => <Option key={dept} value={dept}>{dept}</Option>)}
                </Select>
              </Form.Item>
              <Form.Item name="contact_person" label="原联系人及电话 (可修改)">
                <Input placeholder="提取的联系人信息" />
              </Form.Item>
              <Form.Item name="tags" label="业务标签 (可修改)">
                <Select mode="tags" placeholder="选择或输入标签" allowClear>
                  {presetTags.map(tag => <Option key={tag.name} value={tag.name}>{tag.name}</Option>)}
                </Select>
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
                            <Form.Item name="received_time" label="收件时间 (可修改)">
                <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm:ss" />
              </Form.Item>
              <Form.Item name="event_time" label="起止时间段 (可修改)">
                <DatePicker.RangePicker showTime style={{ width: '100%' }} placeholder={['开始时间', '结束时间']} />
              </Form.Item>
              <Form.Item name="handler" label="办理人 (可编辑)">
                <Input placeholder="输入办理人姓名" />
              </Form.Item>
              <Form.Item name="attachments" label="附件管理 (支持拖拽, 点击文件打开本地路径)" valuePropName="fileList" getValueFromEvent={normFile}>
                <Upload.Dragger multiple customRequest={customUpload} onPreview={handlePreview} onDownload={handleDownload} showUploadList={{ showDownloadIcon: true, showRemoveIcon: true }}>
                  <p className="ant-upload-text">点击或拖拽文件上传至本地目录</p>
                </Upload.Dragger>
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
