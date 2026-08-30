import React, { useEffect, useState } from 'react';
import { Card, Form, Input, Button, message, Space, Tag, Row, Col, Divider, Select } from 'antd';
import { fetchConfig, saveConfig } from '../api';

const { Option } = Select;

const COLORS = ['#f50', '#2db7f5', '#87d068', '#108ee9', '#purple', '#volcano', '#magenta'];

interface TagItem {
  name: string;
  color: string;
}

const Settings: React.FC = () => {
  const [form] = Form.useForm();
  const [departments, setDepartments] = useState<string[]>([]);
  const [newDept, setNewDept] = useState('');
  
  const [tags, setTags] = useState<TagItem[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(COLORS[0]);
  
  const [leaders, setLeaders] = useState<string[]>([]);
  const [newLeader, setNewLeader] = useState('');

  useEffect(() => {
    const loadSettings = async () => {
      const depts = await fetchConfig('preset_departments');
      if (depts) setDepartments(depts);
      
      const loadedTags = await fetchConfig('preset_tags');
      if (loadedTags) setTags(loadedTags);

      const loadedLeaders = await fetchConfig('preset_leaders');
      if (loadedLeaders) setLeaders(loadedLeaders);
      
      const recorder = await fetchConfig('default_recorder');
      form.setFieldsValue({ default_recorder: recorder || '当前值班员' });
    };
    loadSettings();
  }, [form]);

  const handleSaveBasic = async (values: any) => {
    try {
      await saveConfig('default_recorder', values.default_recorder);
      message.success('基础设置保存成功');
    } catch (e) {
      message.error('保存失败');
    }
  };

  const handleAddDept = async () => {
    if (!newDept.trim()) return;
    if (departments.includes(newDept)) return message.warning('部门已存在');
    
    const updated = [...departments, newDept];
    setDepartments(updated);
    setNewDept('');
    await saveConfig('preset_departments', updated);
    message.success('已添加');
  };

  const handleRemoveDept = async (dept: string) => {
    const updated = departments.filter(d => d !== dept);
    setDepartments(updated);
    await saveConfig('preset_departments', updated);
  };

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;
    if (tags.some(t => t.name === newTagName)) return message.warning('标签已存在');
    
    const updated = [...tags, { name: newTagName, color: newTagColor }];
    setTags(updated);
    setNewTagName('');
    await saveConfig('preset_tags', updated);
    message.success('已添加标签');
  };

  const handleRemoveTag = async (tagName: string) => {
    const updated = tags.filter(t => t.name !== tagName);
    setTags(updated);
    await saveConfig('preset_tags', updated);
  };

  const handleAddLeader = async () => {
    if (!newLeader.trim()) return;
    if (leaders.includes(newLeader)) return message.warning('领导已存在');
    
    const updated = [...leaders, newLeader];
    setLeaders(updated);
    setNewLeader('');
    await saveConfig('preset_leaders', updated);
    message.success('已添加');
  };

  const handleRemoveLeader = async (leader: string) => {
    const updated = leaders.filter(l => l !== leader);
    setLeaders(updated);
    await saveConfig('preset_leaders', updated);
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 24 }}>系统设置 (System Config)</h2>
      
      <Card title="基础设置" bordered={false} className="shadow-sm" style={{ marginBottom: 24 }}>
        <Form form={form} layout="vertical" onFinish={handleSaveBasic}>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="default_recorder" label="默认值班员姓名">
                <Input placeholder="输入默认值班员姓名" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Button type="primary" htmlType="submit">保存基本设置</Button>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card title="字典管理: 发文单位/部门" bordered={false} className="shadow-sm" style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16 }}>
          {departments.map(dept => (
            <Tag key={dept} closable onClose={() => handleRemoveDept(dept)} style={{ padding: '4px 12px', fontSize: 14, marginBottom: 8 }}>
              {dept}
            </Tag>
          ))}
          {departments.length === 0 && <span style={{ color: '#999' }}>暂无预设部门</span>}
        </div>
        <Divider />
        <Space>
          <Input 
            placeholder="新增部门名称 (例如: 信保科)" 
            value={newDept} 
            onChange={e => setNewDept(e.target.value)} 
            onPressEnter={handleAddDept}
          />
          <Button onClick={handleAddDept}>添加部门</Button>
        </Space>
      </Card>

      <Card title="字典管理: 业务标签 (Tags)" bordered={false} className="shadow-sm">
        <div style={{ marginBottom: 16 }}>
          {tags.map(tag => (
            <Tag key={tag.name} color={tag.color} closable onClose={() => handleRemoveTag(tag.name)} style={{ padding: '4px 12px', fontSize: 14, marginBottom: 8 }}>
              {tag.name}
            </Tag>
          ))}
          {tags.length === 0 && <span style={{ color: '#999' }}>暂无预设标签</span>}
        </div>
        <Divider />
        <Space>
          <Input 
            placeholder="新增标签名称 (例如: 会议)" 
            value={newTagName} 
            onChange={e => setNewTagName(e.target.value)} 
          />
          <Select value={newTagColor} onChange={setNewTagColor} style={{ width: 120 }}>
            {COLORS.map(c => <Option key={c} value={c}><span style={{ color: c }}>●</span> {c}</Option>)}
          </Select>
          <Button onClick={handleAddTag}>添加标签</Button>
        </Space>
      </Card>

      <Card title="字典管理: 流转领导 (Leaders)" bordered={false} className="shadow-sm">
        <div style={{ marginBottom: 16 }}>
          {leaders.map(leader => (
            <Tag key={leader} closable onClose={() => handleRemoveLeader(leader)} style={{ padding: '4px 12px', fontSize: 14, marginBottom: 8 }}>
              {leader}
            </Tag>
          ))}
          {leaders.length === 0 && <span style={{ color: '#999' }}>暂无预设领导</span>}
        </div>
        <Divider />
        <Space>
          <Input 
            placeholder="新增领导姓名 (例如: 张局长)" 
            value={newLeader} 
            onChange={e => setNewLeader(e.target.value)} 
            onPressEnter={handleAddLeader}
          />
          <Button onClick={handleAddLeader}>添加领导</Button>
        </Space>
      </Card>
    </div>
  );
};

export default Settings;
