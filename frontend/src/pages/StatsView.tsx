import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Typography, message, Statistic, Button } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DownloadOutlined } from '@ant-design/icons';
import { fetchNotifications, Notification } from '../api';
import dayjs from 'dayjs';

const { Title } = Typography;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#a05195', '#d45087', '#f95d6a', '#ff7c43'];

const StatsView: React.FC = () => {
  const [data, setData] = useState<Notification[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetchNotifications();
        setData(res);
      } catch (e) {
        message.error('加载统计数据失败');
      }
    };
    loadData();
  }, []);

  // Calculate statistics
  const currentMonth = dayjs().format('YYYY-MM');
  const thisMonthData = data.filter(d => dayjs(d.received_time).format('YYYY-MM') === currentMonth);
  
  const completed = thisMonthData.filter(d => d.status === '已办结').length;
  const total = thisMonthData.length;
  const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);

  // Department distribution
  const deptMap: { [key: string]: number } = {};
  thisMonthData.forEach(d => {
    if (d.sender_dept) {
      deptMap[d.sender_dept] = (deptMap[d.sender_dept] || 0) + 1;
    } else {
      deptMap['未知部门'] = (deptMap['未知部门'] || 0) + 1;
    }
  });
  
  const deptChartData = Object.keys(deptMap).map(key => ({
    name: key,
    value: deptMap[key]
  })).sort((a, b) => b.value - a.value);

  // Status distribution
  const statusMap: { [key: string]: number } = { '待办理': 0, '正在办理': 0, '已办结': 0 };
  thisMonthData.forEach(d => {
    statusMap[d.status] = (statusMap[d.status] || 0) + 1;
  });
  const statusChartData = Object.keys(statusMap).map(key => ({
    name: key,
    value: statusMap[key]
  }));

  const handleExportReport = () => {
    message.success('报表导出中 (这里可接后端 PDF 生成逻辑)');
  };

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>本月工作周报/月报汇总</Title>
        </Col>
        <Col>
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleExportReport}>导出统计报表 (PDF)</Button>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card bordered={false} className="shadow-sm">
             <Statistic title="本月累计通知" value={total} suffix="件" />
          </Card>
        </Col>
        <Col span={8}>
          <Card bordered={false} className="shadow-sm">
             <Statistic title="本月已办结" value={completed} suffix="件" valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card bordered={false} className="shadow-sm">
             <Statistic title="整体办结率" value={completionRate} suffix="%" valueStyle={{ color: completionRate >= 80 ? '#3f8600' : '#cf1322' }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={24}>
        <Col span={14}>
          <Card title="发件部门分布情况 (TOP)" bordered={false} className="shadow-sm" style={{ height: 400 }}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={deptChartData.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#1890ff" name="通知数量" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={10}>
          <Card title="通知状态分布" bordered={false} className="shadow-sm" style={{ height: 400 }}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusChartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {statusChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default StatsView;
