import React, { useEffect, useState } from 'react';
import { Card, Form, Input, Button, message, Space, Tag, Row, Col, Select, Tabs, Popconfirm, Modal, Upload } from 'antd';
import { FolderOpenOutlined, DownloadOutlined, DeleteOutlined, DatabaseOutlined, SettingOutlined, AppstoreOutlined, UploadOutlined, FileTextOutlined, ReloadOutlined, PictureOutlined } from '@ant-design/icons';
import { fetchConfig, saveConfig, triggerSelectFile, exportDatabase, clearDatabase, openFolder, importDatabase, fetchLogs, uploadFile } from '../api';

const { Option } = Select;
const { TabPane } = Tabs;
import { Slider } from 'antd';

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

  const [logVisible, setLogVisible] = useState(false);
  const [logContent, setLogContent] = useState('');
  const [logPath, setLogPath] = useState('');
  const [logLoading, setLogLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const depts = await fetchConfig('preset_departments');
      if (depts) setDepartments(depts);

      const loadedTags = await fetchConfig('preset_tags');
      if (loadedTags) setTags(loadedTags);

      const loadedLeaders = await fetchConfig('preset_leaders');
      if (loadedLeaders) setLeaders(loadedLeaders);

      const recorder = await fetchConfig('default_recorder');
      const llm_enabled = await fetchConfig('llm_enabled');
      const llm_model_path = await fetchConfig('llm_model_path');
      const llm_system_prompt = await fetchConfig('llm_system_prompt');
      const reminder_enabled = await fetchConfig('reminder_enabled');
      const reminder_advance_minutes = await fetchConfig('reminder_advance_minutes');
      
      const bg_image = await fetchConfig('bg_image');
      const bg_opacity = await fetchConfig('bg_opacity');
      const bg_blur = await fetchConfig('bg_blur');

      form.setFieldsValue({
        default_recorder: recorder || '当前值班员',
        llm_enabled: llm_enabled || 'false',
        llm_model_path: llm_model_path || '',
        reminder_enabled: reminder_enabled || 'true',
        reminder_advance_minutes: reminder_advance_minutes || '60',
        bg_image: bg_image || '',
        bg_opacity: bg_opacity !== null ? parseFloat(bg_opacity) : 0.4,
        bg_blur: bg_blur !== null ? parseInt(bg_blur) : 10,
        llm_system_prompt: llm_system_prompt || '你是一个专业的政府机关公文提取助手。请从以下通知中提取关键信息，并严格输出合法的 JSON 格式。如果找不到对应信息，请返回空字符串。\n要求输出的JSON字段：\n- title: 提炼通知核心内容和需要执行的具体任务，生成一句话摘要作为通知标题\n- event_time: 智能推断开始或截止时间，务必推断出年份和具体日期 (YYYY-MM-DD HH:mm:ss 格式)\n- event_end: 结束时间 (若只有一个时间，与 event_time 保持一致)\n- sender_dept: 发件/主办部门\n- contact_person: 联系人与电话'
      });
    };
    loadSettings();
  }, [form]);

  const handleSaveBasic = async (values: any) => {
    try {
      if (values.default_recorder !== undefined) await saveConfig('default_recorder', values.default_recorder);
      if (values.llm_enabled !== undefined) await saveConfig('llm_enabled', values.llm_enabled);
      if (values.llm_model_path !== undefined) await saveConfig('llm_model_path', values.llm_model_path);
      if (values.reminder_enabled !== undefined) await saveConfig('reminder_enabled', values.reminder_enabled);
      if (values.reminder_advance_minutes !== undefined) await saveConfig('reminder_advance_minutes', values.reminder_advance_minutes);
      
      if (values.bg_image !== undefined) await saveConfig('bg_image', values.bg_image);
      if (values.bg_opacity !== undefined) await saveConfig('bg_opacity', values.bg_opacity.toString());
      if (values.bg_blur !== undefined) await saveConfig('bg_blur', values.bg_blur.toString());
      
      // Dispatch custom event to notify App.tsx immediately without refresh
      window.dispatchEvent(new Event('theme_updated'));

      if (values.llm_system_prompt !== undefined) {
        const finalPrompt = values.llm_system_prompt?.trim() || '你是一个专业的政府机关公文提取助手。请从以下通知中提取关键信息，并严格输出合法的 JSON 格式。如果找不到对应信息，请返回空字符串。\n要求输出的JSON字段及要求：\n- title: 提炼通知核心内容和需要执行的具体任务，生成一句话摘要作为通知标题\n- event_time: 智能推断开始或截止时间，务必推断出年份和具体日期 (YYYY-MM-DD HH:mm:ss 格式)\n- event_end: 结束时间 (若只有一个时间，与 event_time 保持一致)\n- sender_dept: 发件/主办部门。如果通知中未明确说明，请根据内容智能推测，**必须且只能**从以下列表中选择最相关的一个：[信息保障科, 装备管理科, 作训科, 战勤计划科, 组织纪检科, 人力资源科, 情报科]。若都不匹配请留空，绝不要输出问号或其它字符。\n- routed_dept: 下发科室/承办科室。即该通知要求哪个科室去执行或参加。若无，返回空\n- tags: 业务标签。请根据通知内容智能推测，**必须且只能**从以下预设标签中选择相关的（可多选，逗号分隔）：[集会教育, 业务工作, 装备保障, 后勤财务, 信息系统, 材料上报, 训练考核, 值班值勤]。若都不匹配请留空，绝不要输出问号或未知等其它字符。\n- contact_person: 联系人与电话';
        await saveConfig('llm_system_prompt', finalPrompt);

        if (!values.llm_system_prompt?.trim()) {
          form.setFieldsValue({ llm_system_prompt: finalPrompt });
          message.success('基础设置保存成功 (已自动为您恢复默认系统提示词)');
          return;
        }
      }

      message.success('设置保存成功');
    } catch (e) {
      console.error(e);
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
    message.success('已添加部门');
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
    message.success('已添加领导');
  };

  const handleRemoveLeader = async (leader: string) => {
    const updated = leaders.filter(l => l !== leader);
    setLeaders(updated);
    await saveConfig('preset_leaders', updated);
  };

  const handleClearDB = async () => {
    try {
      await clearDatabase();
      message.success('数据库已清空 (不含配置信息)');
    } catch (e) {
      message.error('清空失败');
    }
  };

  const renderBasicSettings = () => (
    <Card bordered={false} className="glass-card">
      <Form form={form} layout="vertical" onFinish={handleSaveBasic}>
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item name="default_recorder" label="默认值班员姓名">
              <Input placeholder="输入默认值班员姓名" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="llm_enabled" label="启用本地大模型引擎 (智能摘要提取)" valuePropName="checked">
              <Select>
                <Option value="true">开启 (需配置大模型路径)</Option>
                <Option value="false">关闭 (使用基础 NLP)</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="reminder_enabled" label="启用后台智能临期提醒">
              <Select>
                <Option value="true">开启 (推荐)</Option>
                <Option value="false">关闭</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="reminder_advance_minutes" label="提前多少时间提醒">
              <Select>
                <Option value="15">提前 15 分钟</Option>
                <Option value="30">提前 30 分钟</Option>
                <Option value="60">提前 1 小时</Option>
                <Option value="1440">提前 1 天 (24小时)</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="本地大模型模型路径 (GGUF 格式)">
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="llm_model_path" noStyle>
                  <Input placeholder="例如: C:\models\qwen2-1_5b.gguf" />
                </Form.Item>
                <Button icon={<FolderOpenOutlined />} onClick={async () => {
                  const path = await triggerSelectFile();
                  if (path) form.setFieldsValue({ llm_model_path: path });
                }}>选择模型</Button>
              </Space.Compact>
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="llm_system_prompt" label={
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                <span>大模型系统提示词 (System Prompt) - 建议不熟悉Prompt的用户保持默认</span>
                <Button type="link" size="small" onClick={() => form.setFieldsValue({ llm_system_prompt: '你是一个专业的政府机关公文提取助手。请从以下通知中提取关键信息，并严格输出合法的 JSON 格式。如果找不到对应信息，请返回空字符串。\n要求输出的JSON字段：\n- title: 提炼通知核心内容和需要执行的具体任务，生成一句话摘要作为通知标题\n- event_time: 智能推断开始或截止时间，务必推断出年份和具体日期 (YYYY-MM-DD HH:mm:ss 格式)\n- event_end: 结束时间 (若只有一个时间，与 event_time 保持一致)\n- sender_dept: 发件/主办部门\n- contact_person: 联系人与电话' })}>
                  恢复默认提示词
                </Button>
              </div>
            }>
              <Input.TextArea rows={8} placeholder="如果留空并保存，系统将自动使用默认的提示词约束模型提取..." />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Button type="primary" htmlType="submit">保存基本设置</Button>
          </Col>
        </Row>
      </Form>
    </Card>
  );

  const handleUploadBg = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const path = await uploadFile(file.name, new Uint8Array(buffer));
      form.setFieldsValue({ bg_image: path });
      message.success('壁纸上传成功，请点击下方保存生效');
    } catch (e) {
      message.error('上传失败');
    }
    return false; // Prevent default upload behavior
  };

  const renderThemeSettings = () => (
    <Card bordered={false} className="glass-card">
      <Form 
        form={form} 
        layout="vertical" 
        onFinish={handleSaveBasic}
        onValuesChange={(changedValues, allValues) => {
          if (changedValues.bg_opacity !== undefined || changedValues.bg_blur !== undefined || changedValues.bg_image !== undefined) {
             window.dispatchEvent(new CustomEvent('theme_preview', { detail: allValues }));
          }
        }}
      >
        <Row gutter={24}>
          <Col span={24}>
            <Form.Item name="bg_image" label="自定义背景壁纸 (全屏 Cover 铺满)">
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="bg_image" noStyle>
                  <Input placeholder="本地壁纸路径或 URL" />
                </Form.Item>
                <Upload beforeUpload={handleUploadBg} showUploadList={false}>
                  <Button icon={<PictureOutlined />}>上传壁纸</Button>
                </Upload>
                <Button onClick={() => form.setFieldsValue({ bg_image: '' })}>清除壁纸</Button>
              </Space.Compact>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="bg_opacity" label="卡片面板透明度 (0.0 完全透明 - 1.0 不透明)">
              <Slider min={0} max={1} step={0.05} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="bg_blur" label="毛玻璃模糊强度 (0px 无模糊 - 30px 高斯模糊)">
              <Slider min={0} max={30} step={1} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Button type="primary" htmlType="submit">保存个性化设置</Button>
          </Col>
        </Row>
      </Form>
    </Card>
  );

  const renderDictionary = () => (
    <Row gutter={[24, 24]}>
      <Col xs={24} lg={8}>
        <Card title="发文单位/部门" style={{ height: '100%' }} bordered={false} className="glass-card">
          <div style={{ marginBottom: 16 }}>
            {departments.map(dept => (
              <Tag key={dept} closable onClose={() => handleRemoveDept(dept)} style={{ padding: '4px 12px', fontSize: 14, marginBottom: 8 }}>
                {dept}
              </Tag>
            ))}
            {departments.length === 0 && <span style={{ color: '#999' }}>暂无预设部门</span>}
          </div>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Input
              placeholder="新增部门名称 (例如: 信保科)"
              value={newDept}
              onChange={e => setNewDept(e.target.value)}
              onPressEnter={handleAddDept}
            />
            <Button onClick={handleAddDept}>添加部门</Button>
          </Space>
        </Card>
      </Col>

      <Col xs={24} lg={8}>
        <Card title="业务标签 (Tags)" style={{ height: '100%' }} bordered={false} className="glass-card">
          <div style={{ marginBottom: 16 }}>
            {tags.map(tag => (
              <Tag key={tag.name} color={tag.color} closable onClose={() => handleRemoveTag(tag.name)} style={{ padding: '4px 12px', fontSize: 14, marginBottom: 8 }}>
                {tag.name}
              </Tag>
            ))}
            {tags.length === 0 && <span style={{ color: '#999' }}>暂无预设标签</span>}
          </div>
          <Space direction="vertical" style={{ width: '100%' }}>
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
      </Col>

      <Col xs={24} lg={8}>
        <Card title="流转领导 (Leaders)" style={{ height: '100%' }} bordered={false} className="glass-card">
          <div style={{ marginBottom: 16 }}>
            {leaders.map(leader => (
              <Tag key={leader} closable onClose={() => handleRemoveLeader(leader)} style={{ padding: '4px 12px', fontSize: 14, marginBottom: 8 }}>
                {leader}
              </Tag>
            ))}
            {leaders.length === 0 && <span style={{ color: '#999' }}>暂无预设领导</span>}
          </div>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Input
              placeholder="新增领导姓名 (例如: 张局长)"
              value={newLeader}
              onChange={e => setNewLeader(e.target.value)}
              onPressEnter={handleAddLeader}
            />
            <Button onClick={handleAddLeader}>添加领导</Button>
          </Space>
        </Card>
      </Col>
    </Row>
  );

  const handleImportDB = async () => {
    setImporting(true);
    try {
      const result: any = await importDatabase();
      message.success(result?.message || '导入成功');
    } catch (e: any) {
      if (e.message !== "取消选择") {
        message.error(e?.message || '导入失败');
      }
    } finally {
      setImporting(false);
    }
  };

  const handleViewLogs = async () => {
    setLogVisible(true);
    setLogLoading(true);
    try {
      const data: any = await fetchLogs(300);
      setLogContent(data.logs || '暂无日志');
      setLogPath(data.path || '');
    } catch (e) {
      setLogContent('无法获取日志，后端可能未运行。\n请检查：~/.dutytodo/logs/backend.log\n' + e);
    } finally {
      setLogLoading(false);
    }
  };

  const renderDatabaseMgmt = () => (
    <>
      <Row gutter={[24, 24]}>
        <Col span={12}>
          <Card title="数据导出备份" bordered={false} className="glass-card">
            <p style={{ color: '#666', marginBottom: 20 }}>
              一键下载 SQLite 数据库文件 (duty_todo.db)，建议您定期备份系统数据。
            </p>
            <Button type="primary" icon={<DownloadOutlined />} onClick={exportDatabase}>
              导出数据库 (.db)
            </Button>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="数据导入恢复" bordered={false} className="glass-card">
            <p style={{ color: '#666', marginBottom: 20 }}>
              上传备份的 .db 文件以恢复数据。导入前会自动创建当前数据快照备份。
            </p>
            <Button icon={<UploadOutlined />} loading={importing} onClick={handleImportDB}>导入数据库 (.db)</Button>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="附件存储管理" bordered={false} className="glass-card">
            <p style={{ color: '#666', marginBottom: 20 }}>
              打开系统本地附件存储目录。
            </p>
            <Button type="default" icon={<FolderOpenOutlined />} onClick={openFolder}>
              打开附件文件夹
            </Button>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="系统日志" bordered={false} className="glass-card">
            <p style={{ color: '#666', marginBottom: 20 }}>
              查看后端运行日志，可用于排查后端无法加载的问题。
            </p>
            <Button icon={<FileTextOutlined />} onClick={handleViewLogs}>
              查看运行日志
            </Button>
          </Card>
        </Col>
        <Col span={24}>
          <Card title="危险操作 (Danger Zone)" bordered={false} className="glass-card" style={{ borderLeft: '4px solid #ff4d4f' }}>
            <p style={{ color: '#ff4d4f', marginBottom: 20 }}>
              清空所有台账记录（字典和配置会保留）。此操作不可逆转，请在操作前确保已导出备份数据！
            </p>
            <Popconfirm
              title="您确定要清空所有台账数据吗？"
              description="此操作不可逆，请确认您已做好备份！"
              onConfirm={handleClearDB}
              okText="确认清空"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button danger icon={<DeleteOutlined />}>清空业务数据</Button>
            </Popconfirm>
          </Card>
        </Col>
      </Row>

      <Modal
        title={<span><FileTextOutlined /> 后端运行日志</span>}
        open={logVisible}
        onCancel={() => setLogVisible(false)}
        width={800}
        footer={[
          <Button key="refresh" icon={<ReloadOutlined />} onClick={handleViewLogs} loading={logLoading}>
            刷新
          </Button>,
          <Button key="close" onClick={() => setLogVisible(false)}>关闭</Button>,
        ]}
      >
        {logPath && <p style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>日志文件：{logPath}</p>}
        <pre style={{
          background: '#0d1117', color: '#c9d1d9', padding: 16,
          borderRadius: 6, maxHeight: 450, overflowY: 'auto',
          fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap',
        }}>
          {logLoading ? '加载中...' : (logContent || '暂无日志')}
        </pre>
      </Modal>
    </>
  );

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 24 }}>系统设置</h2>
      <Tabs defaultActiveKey="1" tabPosition="top" size="large">
        <TabPane tab={<span><SettingOutlined />基础配置</span>} key="1">
          {renderBasicSettings()}
        </TabPane>
        <TabPane tab={<span><AppstoreOutlined />数据字典</span>} key="2">
          {renderDictionary()}
        </TabPane>
        <TabPane tab={<span><DatabaseOutlined />数据及维护</span>} key="3">
          {renderDatabaseMgmt()}
        </TabPane>
        <TabPane tab={<span><PictureOutlined />个性化主题</span>} key="4">
          {renderThemeSettings()}
        </TabPane>
      </Tabs>
    </div>
  );
};

export default Settings;
