import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Typography, message, DatePicker, Segmented } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import CalendarHeatmap from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';
import { fetchNotifications } from '../api';
import type { Notification } from '../api';
import dayjs from 'dayjs';
import './StatsView.css';

const { Title } = Typography;
const { RangePicker } = DatePicker;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#a05195', '#d45087'];

const StatsView: React.FC = () => {
  const [data, setData] = useState<Notification[]>([]);
  const [heatmapData, setHeatmapData] = useState<any[]>([]);
  
  // Custom date range
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().subtract(1, 'month'), dayjs()]);
  const [rangeType, setRangeType] = useState<string>('month');

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetchNotifications();
        setData(res);
        
        // Generate heatmap data for the last 6 months regardless of range picker (or we could bind it)
        const heatmapCounts: Record<string, number> = {};
        res.forEach((n: Notification) => {
          const d = dayjs(n.received_time).format('YYYY-MM-DD');
          heatmapCounts[d] = (heatmapCounts[d] || 0) + 1;
        });
        
        const hData = Object.keys(heatmapCounts).map(date => ({
          date,
          count: heatmapCounts[date]
        }));
        setHeatmapData(hData);

      } catch (error) {
        message.error('加载统计数据失败');
      }
    };
    loadData();
  }, []);

  const handleRangeChange = (val: string) => {
    setRangeType(val);
    const end = dayjs();
    let start = end;
    if (val === 'week') start = end.subtract(1, 'week');
    if (val === 'month') start = end.subtract(1, 'month');
    if (val === 'quarter') start = end.subtract(3, 'month');
    if (val === 'year') start = end.subtract(1, 'year');
    
    setDateRange([start, end]);
  };

  // Filter data for charts based on Date Range
  const filteredData = data.filter(n => {
    const d = dayjs(n.received_time);
    return d.isAfter(dateRange[0]) && d.isBefore(dateRange[1].add(1, 'day'));
  });

  // Department Stats
  const deptMap: Record<string, number> = {};
  filteredData.forEach(n => {
    const dept = n.sender_dept || '未知部门';
    deptMap[dept] = (deptMap[dept] || 0) + 1;
  });
  const deptChartData = Object.keys(deptMap).map(k => ({ name: k, count: deptMap[k] }));

  // Status Stats
  const statusMap: Record<string, number> = {};
  filteredData.forEach(n => {
    statusMap[n.status] = (statusMap[n.status] || 0) + 1;
  });
  const statusChartData = Object.keys(statusMap).map(k => ({ name: k, value: statusMap[k] }));

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>统计分析与报表</Title>
        <div style={{ display: 'flex', gap: 16 }}>
          <Segmented 
            options={[
              { label: '本周', value: 'week' },
              { label: '本月', value: 'month' },
              { label: '本季', value: 'quarter' },
              { label: '本年', value: 'year' },
            ]}
            value={rangeType}
            onChange={handleRangeChange}
          />
          <RangePicker 
            value={dateRange} 
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setDateRange([dates[0], dates[1]]);
                setRangeType('custom');
              }
            }} 
          />
        </div>
      </div>

      <Card title="年度通知热力图 (Activity Heatmap)" bordered={false} className="shadow-sm" style={{ marginBottom: 24 }}>
        <CalendarHeatmap
          startDate={dayjs().subtract(1, 'year').toDate()}
          endDate={dayjs().toDate()}
          values={heatmapData}
          classForValue={(value) => {
            if (!value) {
              return 'color-empty';
            }
            return `color-scale-${Math.min(value.count, 4)}`;
          }}
          tooltipDataAttrs={(value: any) => {
            return {
              'data-tip': `${value.date || ''} : ${value.count || 0} 条通知`,
            };
          }}
        />
      </Card>

      <Row gutter={24}>
        <Col span={12}>
          <Card title="各部门发文量统计" bordered={false} className="shadow-sm" style={{ height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#1890ff" name="通知数量" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="办理状态占比" bordered={false} className="shadow-sm" style={{ height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusChartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                  label={(props: any) => `${props.name} ${((props.percent || 0) * 100).toFixed(0)}%`}
                >
                  {statusChartData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default StatsView;
