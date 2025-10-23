import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Inline, Stack, Text } from '@forge/react';
import { invoke } from '@forge/bridge';

const App: React.FC = () => {
  const [message, setMessage] = useState<string>('Loading...');

  useEffect(() => {
    const loadMessage = async () => {
      try {
        const response = await invoke<string>('getText', { example: 'my-invoke-variable' });
        setMessage(response);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        setMessage(`Failed to load message: ${reason}`);
      }
    };

    void loadMessage();
  }, []);

  return (
    <Stack>
      <Text>Welcome to your Forge issue panel.</Text>
      <Inline space="space.100">
        <Text>Status:</Text>
        <Text>{message}</Text>
      </Inline>
    </Stack>
  );
};

(ForgeReconciler as any).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
