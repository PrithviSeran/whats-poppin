import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Alert, Button, TextInput } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { ThemedView } from './ThemedView';
import { ThemedText } from './ThemedText';

interface AccountProps {
  session: Session;
}

export default function Account({ session }: AccountProps) {
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    if (session) getProfile();
  }, [session]);

  async function getProfile() {
    try {
      setLoading(true);
      if (!session?.user) throw new Error('No user on the session!');

      const { data, error, status } = await supabase
        .from('profiles')
        .select(`username, full_name, avatar_url`)
        .eq('id', session?.user.id)
        .single();

      if (error && status !== 406) {
        throw error;
      }

      if (data) {
        setUsername(data.username);
        setFullName(data.full_name);
        setAvatarUrl(data.avatar_url);
      }
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert('Error', error.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function updateProfile({
    username,
    fullName,
    avatarUrl,
  }: {
    username: string;
    fullName: string;
    avatarUrl: string;
  }) {
    try {
      setLoading(true);
      if (!session?.user) throw new Error('No user on the session!');

      const updates = {
        id: session?.user.id,
        username,
        full_name: fullName,
        avatar_url: avatarUrl,
        updated_at: new Date(),
      };

      const { error } = await supabase.from('profiles').upsert(updates);

      if (error) {
        throw error;
      }
      Alert.alert('Success', 'Profile updated!');
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert('Error', error.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.header}>Account</ThemedText>
      <ThemedText>Email: {session?.user?.email}</ThemedText>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Username"
          value={username || ''}
          onChangeText={setUsername}
        />
        <TextInput
          style={styles.input}
          placeholder="Full Name"
          value={fullName || ''}
          onChangeText={setFullName}
        />
      </View>
      <View style={styles.buttonContainer}>
        <Button
          title="Update Profile"
          onPress={() => updateProfile({ username, fullName, avatarUrl })}
          disabled={loading}
        />
        <Button title="Sign Out" onPress={signOut} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    height: '100%',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  inputContainer: {
    marginVertical: 20,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
});