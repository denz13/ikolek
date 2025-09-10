// UsersLogin.js (username-as-uid; no uid field in Firestore doc)
import React, { useContext, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image, Alert, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ThemeContext } from './ThemeContext';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebasecollector/firebase';
import { signInAnonymously, updateProfile } from 'firebase/auth';

const usernameRegex =
  /^(?=[a-zA-Z0-9._]{3,20}$)(?=.*[a-zA-Z])(?=.*[0-9])(?!.*[_.]{2})[^_.].*[^_.]$/;

export default function UsersLogin() {
  const { isDarkMode } = useContext(ThemeContext);
  const navigation = useNavigation();
  const [userIdInput, setUserIdInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUserIdConfirm = async () => {
    const username = userIdInput.trim();

    if (!username) {
      return Alert.alert('Missing Username', 'Please enter a username.');
    }
    if (!usernameRegex.test(username)) {
      return Alert.alert(
        'Invalid Format',
        'Username must be 3–20 characters, include letters & numbers, and may contain _ or . (not at edges or consecutive).'
      );
    }

    setLoading(true);
    try {
      // Try to establish a session (optional). If it fails, we still proceed.
      try {
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }
        try { await updateProfile(auth.currentUser, { displayName: username }); } catch {}
      } catch (e) {
        // Silent fallback if API key restrictions block anonymous auth
        console.log('Anonymous auth not available; continuing without it.', e?.code || e);
      }

      // Firestore user profile at users/<username>
      const userRef = doc(db, 'users', username);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        await setDoc(userRef, {
          userId: username,            // mirrors doc.id (no separate uid field)
          role: 'user',
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(userRef, { updatedAt: serverTimestamp() }, { merge: true });
      }

      // Navigate; Reports reads uid/userId from params
      navigation.navigate('UsersTabs', { uid: username, userId: username });
    } catch (error) {
      console.error('User login error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDarkMode ? '#121212' : '#f8f9fa',
      paddingHorizontal: 30,
    },
    logo: { width: 100, height: 100, marginBottom: 20, borderRadius: 50 },
    label: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 8,
      color: isDarkMode ? '#e0e0e0' : '#333',
      alignSelf: 'center',
    },
    input: {
      width: '100%',
      height: 48,
      borderWidth: 1,
      borderColor: isDarkMode ? '#444' : '#ccc',
      borderRadius: 10,
      paddingHorizontal: 15,
      marginBottom: 20,
      backgroundColor: isDarkMode ? '#222' : '#fff',
      color: isDarkMode ? '#eee' : '#222',
      fontSize: 16,
    },
    button: {
      backgroundColor: '#146c43',
      paddingVertical: 14,
      borderRadius: 12,
      width: '100%',
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
    },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    signupContainer: { marginTop: 20, flexDirection: 'row' },
    signupText: { color: isDarkMode ? '#aaa' : '#555' },
    signupLink: { color: isDarkMode ? '#80bdff' : '#146c43', fontWeight: 'bold', marginLeft: 5 },
  };

  return (
    <View style={styles.container}>
      <Image source={require('../assets/wasteui.jpeg')} style={styles.logo} />

      <Text style={styles.label}>Username</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter username"
        placeholderTextColor={isDarkMode ? '#aaa' : '#888'}
        value={userIdInput}
        onChangeText={setUserIdInput}
        editable={!loading}
        autoCapitalize="none"
      />

      <TouchableOpacity style={styles.button} onPress={handleUserIdConfirm} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Confirm</Text>}
      </TouchableOpacity>

      <View style={styles.signupContainer}>
        <Text style={styles.signupText}>Not a User?</Text>
        <TouchableOpacity onPress={() => navigation.navigate('CollectorsLogin')}>
          <Text style={styles.signupLink}>Login as Collector</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
