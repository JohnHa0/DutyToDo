import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Typography, message, DatePicker, Segmented, Select, Space } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Sankey } from 'recharts';
import CalendarHeatmap from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';
import { fetchNotifications } from '../api';
import type { Notification } from '../api';
import dayjs from 'dayjs';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import './StatsView.css';

const { Title } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#a05195', '#d45087'];

const sankeyOptions = [
  { label: '发件部门', value: 'sender_dept' },
  { label: '流转领导', value: 'routed_leaders' },
  { label: '办理人', value: 'handler' },
  { label: '办理状态', value: 'status' },
  { label: '重要程度', value: 'priority' }
];

const StatsView: React.FC = () => {
  const [data, setData] = useState<Notification[]>([]);
  const [heatmapData, setHeatmapData] = useState<any[]>([]);

  // Custom date range
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().subtract(1, 'month'), dayjs()]);
  const [rangeType, setRangeType] = useState<string>('month');

  const [sankeyFields, setSankeyFields] = useState<string[]>(['sender_dept', 'status']);

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetchNotifications();
        setData(res);

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

  // Heatmap Data (Reacts to filteredData)
  const heatmapCounts: Record<string, number> = {};
  filteredData.forEach(n => {
    const d = dayjs(n.received_time).format('YYYY-MM-DD');
    heatmapCounts[d] = (heatmapCounts[d] || 0) + 1;
  });
  const filteredHeatmapData = Object.keys(heatmapCounts).map(date => ({
    date,
    count: heatmapCounts[date]
  }));

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

  const buildSankeyData = () => {
    if (sankeyFields.length < 2) return null;

    const nodesMap = new Map<string, number>();
    const linksMap = new Map<string, number>();

    filteredData.forEach(n => {
      for (let i = 0; i < sankeyFields.length - 1; i++) {
        let rawSrc = (n as any)[sankeyFields[i]] as string;
        let rawTgt = (n as any)[sankeyFields[i + 1]] as string;
        let srcVals = typeof rawSrc === 'string' && rawSrc ? rawSrc.split(',') : ['未知'];
        let tgtVals = typeof rawTgt === 'string' && rawTgt ? rawTgt.split(',') : ['未知'];

        let srcPrefix = `L${i}_`;
        let tgtPrefix = `L${i + 1}_`;

        srcVals.forEach(src => {
          let sName = src.trim() || '未知';
          let sId = srcPrefix + sName;

          tgtVals.forEach(tgt => {
            let tName = tgt.trim() || '未知';
            let tId = tgtPrefix + tName;

            if (!nodesMap.has(sId)) nodesMap.set(sId, nodesMap.size);
            if (!nodesMap.has(tId)) nodesMap.set(tId, nodesMap.size);

            let linkKey = sId + '|||' + tId;
            linksMap.set(linkKey, (linksMap.get(linkKey) || 0) + 1);
          });
        });
      }
    });

    if (nodesMap.size === 0) return null;

    const nodes = Array.from(nodesMap.keys()).map(k => ({ name: k.split('_')[1] || k }));
    const links = Array.from(linksMap.entries()).map(([k, v]) => {
      const [s, t] = k.split('|||');
      return {
        source: nodesMap.get(s)!,
        target: nodesMap.get(t)!,
        value: v
      };
    });

    return { nodes, links };
  };

  const sankeyData = buildSankeyData();

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

      <Card title={rangeType === 'week' || rangeType === 'month' ? "收文趋势图" : "收文热力图"} bordered={false} className="glass-card" style={{ marginBottom: 24 }}>
        {(rangeType === 'week' || rangeType === 'month') ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={filteredHeatmapData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tickFormatter={(tick) => dayjs(tick).format('MM-DD')} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
              <Tooltip labelFormatter={(label) => `日期: ${label}`} formatter={(val) => [val, '通知数量']} />
              <Bar dataKey="count" fill="#36cfc9" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ 
            width: '100%', 
            maxWidth: Math.max(300, dayjs(dateRange[1]).diff(dateRange[0], 'week') * 18 + 50),
            margin: '0 auto' 
          }}>
            <CalendarHeatmap
              startDate={dateRange[0].toDate()}
              endDate={dateRange[1].toDate()}
              values={filteredHeatmapData}
              showWeekdayLabels={true}
              monthLabels={['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']}
              weekdayLabels={['日', '一', '二', '三', '四', '五', '六']}

              classForValue={(value) => {
                if (!value) {
                  return 'color-empty';
                }
                return `color-scale-${Math.min(value.count, 4)}`;
              }}
              tooltipDataAttrs={(value: any) => {
                return {
                  'data-tooltip-id': 'heatmap-tooltip',
                  'data-tooltip-content': `${value?.date || ''} : ${value?.count || 0} 条通知`,
                } as any;
              }}
            />
          </div>
        )}
        <ReactTooltip id="heatmap-tooltip" />
      </Card>

      <Row gutter={24}>
        <Col span={12}>
          <Card title="各部门发文量统计" bordered={false} className="glass-card" style={{ marginBottom: 24 }}>
            <ResponsiveContainer width="100%" height={300}>
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
          <Card title="办理状态占比" bordered={false} className="glass-card" style={{ marginBottom: 24 }}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusChartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
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

      <Card
        title="入库通知流向分析 (Sankey Diagram)"
        bordered={false}
        className="glass-card"
        style={{ marginBottom: 24 }}
        extra={
          <Space>
            层级分析字段 (按顺序连线):
            <Select
              mode="multiple"
              value={sankeyFields}
              onChange={(val) => setSankeyFields(val)}
              style={{ minWidth: 300 }}
              placeholder="至少选择两项进行流向分析"
            >
              {sankeyOptions.map(opt => <Option key={opt.value} value={opt.value}>{opt.label}</Option>)}
            </Select>
          </Space>
        }
      >
        {sankeyData && sankeyData.nodes.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <Sankey
              data={sankeyData}
              node={{ fill: '#1890ff', stroke: '#096dd9' }}
              nodePadding={50}
              margin={{ left: 20, right: 20, top: 20, bottom: 20 }}
              link={{ stroke: '#e2e2e2' }}
            >
              <Tooltip />
            </Sankey>
          </ResponsiveContainer>
        ) : (
          <div style={{ textAlign: 'center', padding: '50px 0', color: '#999' }}>当前所选范围无数据可用于流向分析</div>
        )}
      </Card>
    </div>
  );
};

export default StatsView;
