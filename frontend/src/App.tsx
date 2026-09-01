import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Layout, Menu, Typography, Badge } from 'antd';
import {
  DashboardOutlined,
  EditOutlined,
  UnorderedListOutlined,
  CalendarOutlined,
  BarChartOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { appWindow } from '@tauri-apps/api/window';
import { AnimatePresence, motion } from 'framer-motion';
import Dashboard from './pages/Dashboard';
import EntryForm from './pages/EntryForm';
import NotificationList from './pages/NotificationList';
import CalendarView from './pages/CalendarView';
import StatsView from './pages/StatsView';
import Settings from './pages/Settings';
import NotificationTracker from './components/NotificationTracker';
import { fetchConfig } from './api';

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

// Custom window controls for frameless window
const WindowControls: React.FC = () => {
  const [hovered, setHovered] = React.useState<string | null>(null);

  const btnBase: React.CSSProperties = {
    width: 14, height: 14, borderRadius: '50%', border: 'none',
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 9, fontWeight: 'bold',
    color: 'transparent', transition: 'all 0.15s ease',
  };

  return (
    <div
      style={{ display: 'flex', gap: 8, alignItems: 'center' }}
      onMouseLeave={() => setHovered(null)}
    >
      <button
        title="关闭"
        style={{ ...btnBase, background: '#ff5f57', color: hovered === 'close' ? '#7a0000' : 'transparent' }}
        onMouseEnter={() => setHovered('close')}
        onClick={() => appWindow.close()}
      >✕</button>
      <button
        title="最小化"
        style={{ ...btnBase, background: '#febc2e', color: hovered === 'min' ? '#5a3a00' : 'transparent' }}
        onMouseEnter={() => setHovered('min')}
        onClick={() => appWindow.minimize()}
      >–</button>
      <button
        title="最大化"
        style={{ ...btnBase, background: '#28c840', color: hovered === 'max' ? '#005a00' : 'transparent' }}
        onMouseEnter={() => setHovered('max')}
        onClick={() => appWindow.toggleMaximize()}
      >+</button>
    </div>
  );
};

const pageVariants = {
  initial: { opacity: 0, y: 15 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -15 }
};

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<motion.div initial="initial" animate="in" exit="out" variants={pageVariants} transition={{ duration: 0.3 }}><Dashboard /></motion.div>} />
        <Route path="/entry" element={<motion.div initial="initial" animate="in" exit="out" variants={pageVariants} transition={{ duration: 0.3 }}><EntryForm /></motion.div>} />
        <Route path="/list" element={<motion.div initial="initial" animate="in" exit="out" variants={pageVariants} transition={{ duration: 0.3 }}><NotificationList /></motion.div>} />
        <Route path="/calendar" element={<motion.div initial="initial" animate="in" exit="out" variants={pageVariants} transition={{ duration: 0.3 }}><CalendarView /></motion.div>} />
        <Route path="/stats" element={<motion.div initial="initial" animate="in" exit="out" variants={pageVariants} transition={{ duration: 0.3 }}><StatsView /></motion.div>} />
        <Route path="/settings" element={<motion.div initial="initial" animate="in" exit="out" variants={pageVariants} transition={{ duration: 0.3 }}><Settings /></motion.div>} />
      </Routes>
    </AnimatePresence>
  );
};

import { readBinaryFile } from '@tauri-apps/api/fs';

const App: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [bgImage, setBgImage] = useState<string>('');
  const [bgOpacity, setBgOpacity] = useState<number>(0.4);
  const [bgBlur, setBgBlur] = useState<number>(10);

  const loadTheme = async () => {
    let img = await fetchConfig('bg_image');
    if (img) {
      if (img.startsWith('http') || img.startsWith('data:') || img.startsWith('blob:')) {
        setBgImage(img);
      } else {
        try {
          const bytes = await readBinaryFile(img);
          const blob = new Blob([bytes as any]);
          setBgImage(URL.createObjectURL(blob));
        } catch (e) {
          console.error("Failed to load background image:", e);
          setBgImage('');
        }
      }
    } else {
      setBgImage('');
    }
    
    const op = await fetchConfig('bg_opacity');
    if (op !== null) setBgOpacity(parseFloat(op));
    
    const bl = await fetchConfig('bg_blur');
    if (bl !== null) setBgBlur(parseInt(bl));
  };

  useEffect(() => {
    loadTheme();
    const handlePreview = async (e: any) => {
      const detail = e.detail;
      if (detail.bg_opacity !== undefined) setBgOpacity(parseFloat(detail.bg_opacity));
      if (detail.bg_blur !== undefined) setBgBlur(parseInt(detail.bg_blur));
      if (detail.bg_image !== undefined && detail.bg_image !== bgImage) {
        if (!detail.bg_image) {
          setBgImage('');
        } else if (detail.bg_image.startsWith('http') || detail.bg_image.startsWith('data:') || detail.bg_image.startsWith('blob:')) {
          setBgImage(detail.bg_image);
        } else {
          try {
            const bytes = await readBinaryFile(detail.bg_image);
            const blob = new Blob([bytes as any]);
            setBgImage(URL.createObjectURL(blob));
          } catch(e) {}
        }
      }
    };
    
    window.addEventListener('theme_updated', loadTheme);
    window.addEventListener('theme_preview', handlePreview);
    return () => {
      window.removeEventListener('theme_updated', loadTheme);
      window.removeEventListener('theme_preview', handlePreview);
    };
  }, []);

  return (
    <Router>
      <NotificationTracker />
      <style>
        {`
          .glass-card, .ant-card, .ant-descriptions, .fc-view-harness {
             background: rgba(255, 255, 255, ${bgOpacity}) !important;
             backdrop-filter: blur(${bgBlur}px) !important;
             -webkit-backdrop-filter: blur(${bgBlur}px) !important;
             border-color: rgba(255, 255, 255, 0.18) !important;
          }
          .ant-card-head {
             border-bottom: 1px solid rgba(255, 255, 255, 0.18) !important;
          }
          .ant-layout-content {
             background: transparent !important;
             border: none !important;
             backdrop-filter: none !important;
          }
          @media (prefers-color-scheme: dark) {
            .glass-card, .ant-card, .ant-descriptions, .fc-view-harness {
               background: rgba(30, 30, 40, ${bgOpacity}) !important;
               border-color: rgba(255, 255, 255, 0.05) !important;
            }
          }
        `}
      </style>
      <Layout style={{ minHeight: '100vh', background: 'transparent', backgroundImage: bgImage ? `url("${bgImage}")` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={(value) => setCollapsed(value)}
          breakpoint="lg"
          collapsedWidth="80"
          style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'rgba(0, 21, 41, 0.85)', backdropFilter: 'blur(10px)' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div data-tauri-drag-region style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.2)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', flexShrink: 0 }}>
              {collapsed ? 'Duty' : '值班助手 DutyToDo'}
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <Menu theme="dark" defaultSelectedKeys={['1']} mode="inline" style={{ background: 'transparent' }}>
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
              {collapsed ? 'v2.0' : `值班助手 v2.0.0\n系统组© ${new Date().getFullYear()}`}
            </div>
          </div>
        </Sider>
        <Layout className="site-layout" style={{ background: 'transparent' }}>
          <Header data-tauri-drag-region style={{ padding: '0 16px 0 24px', background: `rgba(255, 255, 255, ${Math.min(0.9, bgOpacity + 0.2)})`, backdropFilter: `blur(${bgBlur}px)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.05)' } as any}>
            <Title level={4} style={{ margin: 0 }}>值班通知智能流转系统</Title>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <WindowControls />
              <Badge count={0} offset={[10, 0]}>
                <div style={{ width: 32, height: 32, background: '#e6f7ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #91d5ff' }}>
                  值
                </div>
              </Badge>
            </div>
          </Header>
          <Content style={{ margin: '16px 16px', padding: 24, borderRadius: 12, overflowY: 'auto' }}>
            <AnimatedRoutes />
          </Content>
        </Layout>
      </Layout>
    </Router>
  );
};

export default App;
