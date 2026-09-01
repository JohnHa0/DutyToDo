import { invoke } from '@tauri-apps/api/tauri';
import { open, save } from '@tauri-apps/api/dialog';
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
  handler?: string;
  attachments?: any;
  updated_at?: string;
}

export const fetchNotifications = async (params?: any): Promise<Notification[]> => {
  return await invoke<Notification[]>('get_notifications', { params });
};

export const createNotification = async (data: Notification): Promise<Notification> => {
  return await invoke<Notification>('create_notification', { data });
};

export const updateNotification = async (id: number, data: Partial<Notification>) => {
  return await invoke('update_notification', { id, data });
};

export const deleteNotification = async (id: number) => {
  return await invoke('delete_notification', { id });
};

// System Config APIs
export interface SystemConfig {
  key: string;
  value: any;
}

export const fetchConfig = async (key: string) => {
  try {
    const val: string = await invoke('get_config', { key });
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch (e) {
        return val;
      }
    }
    return val;
  } catch (e) {
    return null;
  }
};

export const saveConfig = async (key: string, value: any) => {
  let valueStr = typeof value === 'string' ? value : JSON.stringify(value);
  return await invoke('set_config', { key, value: valueStr });
};

export const extractNLP = async (text: string): Promise<any> => {
  return await invoke('extract_nlp', { text });
};

export const exportDatabase = async () => {
  const savePath = await save({
    filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    defaultPath: 'duty_todo_backup.db'
  });
  if (savePath) {
    await invoke('export_database', { path: savePath });
  }
};

export const clearDatabase = async () => {
  return await invoke('clear_database');
};

export const importDatabase = async () => {
  const selected = await open({
    filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    multiple: false,
  });
  if (selected && !Array.isArray(selected)) {
    return await invoke('import_database', { path: selected });
  }
  throw new Error("取消选择");
};

export const fetchLogs = async (lines = 300) => {
  return await invoke('get_logs', { lines });
};

export const openFolder = async () => {
  await invoke('open_attachment_folder');
};

import { copyFile } from '@tauri-apps/api/fs';

export const uploadFile = async (name: string, data: Uint8Array): Promise<string> => {
  return await invoke('upload_file', { name, data: Array.from(data) });
};

export const openFile = async (path: string) => {
  await invoke('open_file', { path });
};

export const downloadAttachment = async (sourcePath: string, defaultName: string) => {
  const targetPath = await save({
    defaultPath: defaultName
  });
  if (targetPath) {
    await copyFile(sourcePath, targetPath);
    return true;
  }
  return false;
};

export const triggerSelectFile = async () => {
  const selected = await open({
    multiple: false,
    filters: [{ name: 'Model Files', extensions: ['gguf', 'bin'] }]
  });
  if (selected && !Array.isArray(selected)) {
    return selected as string;
  }
  return null;
};
