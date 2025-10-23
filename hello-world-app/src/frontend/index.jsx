import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Text, Stack, Inline } from '@forge/react';
import { invoke } from '@forge/bridge';

const App = () => {
  const [message, setMessage] = useState('Loading...');

  // We fetch content from the resolver so the panel demonstrates a round-trip.
  useEffect(() => {
    const loadMessage = async () => {
      try {
        const response = await invoke('getText', { example: 'my-invoke-variable' });
        setMessage(response);
      } catch (error) {
        // Surface resolver issues in the UI so the user is aware something went wrong.
        setMessage(`Failed to load message: ${error.message ?? String(error)}`);
      }
    };

    loadMessage();
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

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
