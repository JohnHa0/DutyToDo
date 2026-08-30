import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Notification {
  id?: number;
  title: string;
  raw_text?: string;
  received_time?: string;
  event_time?: string;
  event_end?: string;
  sender_dept?: string;
  contact_person?: string;
  status: '待办理' | '正在办理' | '已办结';
  routed_leaders?: string;
  dept_heads?: string;
  tags?: string;
  priority: '普通' | '重要' | '紧急';
  recorder?: string;
  attachments?: any;
  updated_at?: string;
}

export const fetchNotifications = async (params?: any) => {
  const response = await apiClient.get('/notifications/', { params });
  return response.data;
};

export const createNotification = async (data: Notification) => {
  const response = await apiClient.post('/notifications/', data);
  return response.data;
};

export const updateNotification = async (id: number, data: Partial<Notification>) => {
  const response = await apiClient.put(`/notifications/${id}`, data);
  return response.data;
};

export const deleteNotification = async (id: number) => {
  const response = await apiClient.delete(`/notifications/${id}`);
  return response.data;
};

// System Config APIs
export interface SystemConfig {
  key: string;
  value: any;
}

export const fetchConfig = async (key: string) => {
  try {
    const response = await apiClient.get(`/config/${key}`);
    return response.data.value;
  } catch (e) {
    return null;
  }
};

export const saveConfig = async (key: string, value: any) => {
  const response = await apiClient.post('/config/', { key, value });
  return response.data.value;
};

export const triggerSelectFile = async () => {
  const response = await apiClient.get('/config/select_file');
  return response.data.path;
};

export const extractNLP = async (text: string) => {
  const response = await apiClient.post('/extract/', { text });
  return response.data;
};
