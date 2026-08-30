import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Layout, Menu, Typography, Badge } from 'antd';
import {
  DashboardOutlined,
  EditOutlined,
  UnorderedListOutlined,
  CalendarOutlined,
  BarChartOutlined,
  SettingOutlined
} from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import EntryForm from './pages/EntryForm';
import NotificationList from './pages/NotificationList';
import CalendarView from './pages/CalendarView';
import StatsView from './pages/StatsView';
import Settings from './pages/Settings';

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

// Detect if running inside Electron
const isElectron = !!(window as any).electronAPI?.isElectron;

// Custom window controls for frameless Electron window
const WindowControls: React.FC = () => {
  const [hovered, setHovered] = React.useState<string | null>(null);
  if (!isElectron) return null;

  const api = (window as any).electronAPI;
  const btnBase: React.CSSProperties = {
    width: 14, height: 14, borderRadius: '50%', border: 'none',
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 9, fontWeight: 'bold',
    color: 'transparent', transition: 'all 0.15s ease',
    WebkitAppRegion: 'no-drag',
  } as any;

  return (
    <div
      style={{ display: 'flex', gap: 8, alignItems: 'center', WebkitAppRegion: 'no-drag' } as any}
      onMouseLeave={() => setHovered(null)}
    >
      <button
        title="关闭"
        style={{ ...btnBase, background: '#ff5f57', color: hovered === 'close' ? '#7a0000' : 'transparent' }}
        onMouseEnter={() => setHovered('close')}
        onClick={() => api.closeWindow()}
      >✕</button>
      <button
        title="最小化"
        style={{ ...btnBase, background: '#febc2e', color: hovered === 'min' ? '#5a3a00' : 'transparent' }}
        onMouseEnter={() => setHovered('min')}
        onClick={() => api.minimizeWindow()}
      >–</button>
      <button
        title="最大化"
        style={{ ...btnBase, background: '#28c840', color: hovered === 'max' ? '#005a00' : 'transparent' }}
        onMouseEnter={() => setHovered('max')}
        onClick={() => api.maximizeWindow()}
      >+</button>
    </div>
  );
};

const App: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={(value) => setCollapsed(value)}
          breakpoint="lg"
          collapsedWidth="80"
          style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.2)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', flexShrink: 0 }}>
              {collapsed ? 'Duty' : '值班助手 DutyToDo'}
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <Menu theme="dark" defaultSelectedKeys={['1']} mode="inline">
                <Menu.Item key="1" icon={<DashboardOutlined />}>
                  <Link to="/">今日概览</Link>
                </Menu.Item>
                <Menu.Item key="2" icon={<EditOutlined />}>
                  <Link to="/entry">智能录入</Link>
                </Menu.Item>
                <Menu.Item key="3" icon={<UnorderedListOutlined />}>
                  <Link to="/list">台账查询</Link>
                </Menu.Item>
                <Menu.Item key="4" icon={<CalendarOutlined />}>
                  <Link to="/calendar">日历视图</Link>
                </Menu.Item>
                <Menu.Item key="5" icon={<BarChartOutlined />}>
                  <Link to="/stats">统计周报</Link>
                </Menu.Item>
                <Menu.Item key="6" icon={<SettingOutlined />}>
                  <Link to="/settings">系统设置</Link>
                </Menu.Item>
              </Menu>
            </div>
            <div style={{ padding: '16px 8px', color: 'rgba(255, 255, 255, 0.45)', textAlign: 'center', fontSize: '12px', flexShrink: 0, whiteSpace: 'pre-line', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              {collapsed ? 'v1.1' : `值班助手 v1.1.0\n系统组© ${new Date().getFullYear()}`}
            </div>
          </div>
        </Sider>
        <Layout className="site-layout">
          <Header style={{ padding: '0 16px 0 24px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', WebkitAppRegion: 'drag' } as any}>
            <Title level={4} style={{ margin: 0, WebkitAppRegion: 'no-drag' } as any}>值班通知智能流转系统</Title>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, WebkitAppRegion: 'no-drag' } as any}>
              <WindowControls />
              <Badge count={0} offset={[10, 0]}>
                <div style={{ width: 32, height: 32, background: '#e6f7ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #91d5ff' }}>
                  值
                </div>
              </Badge>
            </div>
          </Header>
          <Content style={{ margin: '16px 16px', padding: 24, background: '#fff', borderRadius: 8, overflowY: 'auto' }}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/entry" element={<EntryForm />} />
              <Route path="/list" element={<NotificationList />} />
              <Route path="/calendar" element={<CalendarView />} />
              <Route path="/stats" element={<StatsView />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Content>

        </Layout>
      </Layout>
    </Router>
  );
};

export default App;
