import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useCommsStore } from '../../comms/store';
import CommsAuthScreen from './CommsAuthScreen';
import CommsScreen from './CommsScreen';
import CommsGroupScreen from './CommsGroupScreen';
import CommsDMScreen from './CommsDMScreen';
import type { CommsGroup, DirectMessage } from '../../comms/types';

export default function CommsRootScreen() {
  const { session, hydrate } = useCommsStore();
  const [ready, setReady]               = useState(false);
  const [password, setPassword]         = useState('');
  const [activeGroup, setActiveGroup]   = useState<CommsGroup | null>(null);
  const [activeDM, setActiveDM]         = useState<DirectMessage | null>(null);

  useEffect(() => {
    hydrate().then(() => setReady(true));
  }, [hydrate]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: '#f8fafc' }} />;

  const isLoggedIn = !!(session && new Date(session.expiresAt) > new Date());

  if (!isLoggedIn || !password) {
    return <CommsAuthScreen onSuccess={(pw) => setPassword(pw)} />;
  }

  if (activeGroup) {
    return (
      <CommsGroupScreen
        group={activeGroup}
        password={password}
        onBack={() => setActiveGroup(null)}
      />
    );
  }

  if (activeDM) {
    return (
      <CommsDMScreen
        dm={activeDM}
        password={password}
        onBack={() => setActiveDM(null)}
      />
    );
  }

  return (
    <CommsScreen
      onOpenGroup={(g) => setActiveGroup(g)}
      onOpenDM={(d) => setActiveDM(d)}
    />
  );
}
