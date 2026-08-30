import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Row, Col, Select, DatePicker, message, Upload } from 'antd';
import { UploadOutlined, RobotOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { extractNLP, createNotification, fetchConfig } from '../api';
import type { Notification } from '../api';

const { TextArea } = Input;
const { Option } = Select;

const PRESET_DEPARTMENTS = ['省委办公厅', '市委办公厅', '公安局', '应急局', '卫健委', '市政府'];
const TAGS = ['会议', '督导', '通报', '值班', '其他'];

const EntryForm: React.FC = () => {
  const [form] = Form.useForm();
  const [rawText, setRawText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [presetLeaders, setPresetLeaders] = useState<string[]>([]);

  useEffect(() => {
    const loadLeaders = async () => {
      const leaders = await fetchConfig('preset_leaders');
      if (leaders) setPresetLeaders(leaders);
    };
    loadLeaders();
  }, []);

  
  const normFile = (e: any) => {
    if (Array.isArray(e)) return e;
    return e?.fileList;
  };

  const handleExtract = async () => {
    if (!rawText.trim()) {
      message.warning('请先粘贴通知文本');
      return;
    }
    
    setExtracting(true);
    try {
      const res = await extractNLP(rawText);
      message.success('智能识别完成，请核对信息');
      
      form.setFieldsValue({
        title: res.title || '',
        sender_dept: res.sender_dept || '',
        contact_person: res.contact_person || '',
        event_time: res.event_time ? [
          dayjs(res.event_time),
          res.event_end ? dayjs(res.event_end) : dayjs(res.event_time)
        ] : null,
      });
    } catch (error) {
      message.error('智能识别失败，请检查后端连接');
    } finally {
      setExtracting(false);
    }
  };

  const onFinish = async (values: any) => {
    setSubmitting(true);
    try {
      const payload: Notification = {
        title: values.title,
        raw_text: rawText,
        sender_dept: values.sender_dept,
        contact_person: values.contact_person,
        event_time: (values.event_time && values.event_time[0]) ? values.event_time[0].format('YYYY-MM-DD HH:mm:ss') : null,
        event_end: (values.event_time && values.event_time[1]) ? values.event_time[1].format('YYYY-MM-DD HH:mm:ss') : null,
        status: values.status,
        priority: values.priority,
        tags: values.tags ? values.tags.join(',') : '',
        routed_leaders: Array.isArray(values.routed_leaders) ? values.routed_leaders.join(',') : values.routed_leaders,
        dept_heads: values.dept_heads,
        recorder: '当前值班员', // Could be dynamic
        handler: values.handler,
        received_time: values.received_time ? values.received_time.format('YYYY-MM-DD HH:mm:ss') : undefined,
        attachments: values.attachments ? values.attachments.map((f: any) => ({ uid: f.uid, name: f.name, url: (f.response?.url || f.url)?.startsWith('/') ? `http://127.0.0.1:8000${f.response?.url || f.url}` : (f.response?.url || f.url) })) : [],
      };
      
      await createNotification(payload);
      message.success('通知记录保存成功！');
      
      if (values.create_reminder && window.electronAPI) {
          window.electronAPI.showNotification('新待办提醒已创建', `事项: ${values.title}`);
      }
      
      form.resetFields();
      setRawText('');
    } catch (error) {
      message.error('保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Row gutter={24}>
        <Col span={8}>
          <Card title="1. 粘贴上级通知" bordered={false} className="shadow-sm">
            <TextArea 
              rows={12} 
              placeholder="在此粘贴领导微信群或协同办公系统转发的通知原文..." 
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              style={{ marginBottom: 16 }}
            />
            <Button 
              type="primary" 
              icon={<RobotOutlined />} 
              block 
              onClick={handleExtract}
              loading={extracting}
            >
              智能识别与提取
            </Button>
          </Card>
        </Col>
        <Col span={16}>
          <Card title="2. 信息核对与完善" bordered={false} className="shadow-sm">
            <Form 
              form={form} 
              layout="vertical" 
              onFinish={onFinish}
              initialValues={{ status: '待办理', priority: '普通', create_reminder: true, received_time: dayjs() }}
            >
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item name="title" label="通知主体/标题" rules={[{ required: true, message: '标题不能为空' }]}>
                    <Input placeholder="请检查提取的标题或手动输入" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="sender_dept" label="发件部门">
                    <Select showSearch allowClear placeholder="选择或输入提取的发件部门" mode="tags">
                      {PRESET_DEPARTMENTS.map(dept => <Option key={dept} value={dept}>{dept}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="event_time" label="日程/截止时间段">
                    <DatePicker.RangePicker showTime style={{ width: '100%' }} placeholder={['开始时间', '结束时间']} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="priority" label="重要程度">
                    <Select>
                      <Option value="普通">普通</Option>
                      <Option value="重要">重要</Option>
                      <Option value="紧急">紧急 (飘红)</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="status" label="办理状态">
                    <Select>
                      <Option value="待办理">待办理</Option>
                      <Option value="正在办理">正在办理</Option>
                      <Option value="已办结">已办结</Option>
                    </Select>
                  </Form.Item>
                </Col>
                                <Col span={8}>
                  <Form.Item name="received_time" label="收件时间 (默认当前)">
                    <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm:ss" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="tags" label="业务标签">
                    <Select mode="multiple" placeholder="选择标签" allowClear>
                      {TAGS.map(tag => <Option key={tag} value={tag}>{tag}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="contact_person" label="原联系人及电话">
                    <Input placeholder="提取的联系人信息" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="routed_leaders" label="流转领导记录 (支持多选)">
                    <Select mode="tags" placeholder="选择或输入领导姓名" allowClear>
                      {presetLeaders.map(l => <Option key={l} value={l}>{l}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                                <Col span={12}>
                  <Form.Item name="handler" label="办理人/承办人">
                    <Input placeholder="输入负责办理该事项的姓名或部门" />
                  </Form.Item>
                </Col>
                <Col span={24}>
                                        <Form.Item name="attachments" label="附件上传 (支持拖拽)" valuePropName="fileList" getValueFromEvent={normFile}>
                        <Upload.Dragger multiple action="http://localhost:8000/api/upload" showUploadList={true}>
                            <p className="ant-upload-drag-icon"><UploadOutlined /></p>
                            <p className="ant-upload-text">点击或将文件拖拽到这里上传</p>
                            <p className="ant-upload-hint">支持 PDF, Word, Excel 等常用文档格式</p>
                        </Upload.Dragger>
                    </Form.Item>
                </Col>
              </Row>
              
              <Form.Item>
                <Button type="primary" htmlType="submit" size="large" loading={submitting}>
                  保存并入库
                </Button>
                <span style={{ marginLeft: 16, color: '#888' }}>
                   * 日程时间不为空时，将自动为您创建待办提醒
                </span>
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default EntryForm;
