import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#FFD84D' },
        headerTintColor: '#111',
        headerTitleStyle: { fontWeight: '900' },
      }}
    />
  );
}
