interface Window {
  electronAPI: {
    showNotification: (title: string, body: string) => void;
    openExternal: (url: string) => void;
  };
}
