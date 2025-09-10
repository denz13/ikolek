import React, { useContext, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ThemeContext } from './ThemeContext';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../firebasecollector/firebase';
import Icon from 'react-native-vector-icons/Feather';
import * as Crypto from 'expo-crypto';

/** Match Admin normalizer/validator */
const COLLECTOR_ID_REGEX = /^[a-z][a-z0-9_-]{3,19}$/;
const normalizeCollectorId = (v) => (v || '').toLowerCase().replace(/\s+/g, '');

export default function CollectorsLogin() {
  const { isDarkMode } = useContext(ThemeContext);
  const navigation = useNavigation();

  const [collectorId, setCollectorId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const handleCollectorLogin = async () => {
    const idInput = normalizeCollectorId(collectorId);
    const passwordInput = (password || '').trim();

    if (!idInput || !passwordInput) {
      Alert.alert('Missing Information', 'Please enter both Collector ID and password.');
      return;
    }
    if (!COLLECTOR_ID_REGEX.test(idInput)) {
      Alert.alert(
        'Invalid Collector ID',
        "ID must be 4–20 characters, start with a letter, and use only a–z, 0–9, '-' or '_'."
      );
      return;
    }
    if (loading) return;

    setLoading(true);
    try {
      // Direct lookup by doc ID (faster & matches Admin storage)
      const ref = doc(db, 'collectors', idInput);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        Alert.alert('Invalid Login', 'No collector found with this ID.');
        return;
      }

      const collector = { id: snap.id, ...snap.data() };

      if (!collector.password) {
        Alert.alert(
          'Account Issue',
          'Password is not set for this account. Please contact your administrator.'
        );
        return;
      }

      const hashedInput = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        passwordInput
      );

      if (hashedInput !== collector.password) {
        Alert.alert('Invalid Login', 'Incorrect password.');
        return;
      }

      // Optional: gate on flags, e.g., if (collector.disabled) { ... }

      navigation.navigate('CollectorsTabs', { collectorId: collector.id });
    } catch (err) {
      console.error('Login error:', err);
      Alert.alert('Error', 'Something went wrong. Please try again.');
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
      alignSelf: 'center',
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 8,
      color: isDarkMode ? '#e0e0e0' : '#333',
      letterSpacing: 0.3,
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
    passwordContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      height: 48,
      borderWidth: 1,
      borderColor: isDarkMode ? '#444' : '#ccc',
      borderRadius: 10,
      backgroundColor: isDarkMode ? '#222' : '#fff',
      marginBottom: 30,
    },
    passwordInput: {
      flex: 1,
      paddingHorizontal: 15,
      color: isDarkMode ? '#eee' : '#222',
      fontSize: 16,
    },
    passwordIcon: { paddingHorizontal: 15 },
    button: {
      backgroundColor: '#146c43',
      paddingVertical: 14,
      borderRadius: 12,
      width: '100%',
      alignItems: 'center',
      opacity: loading ? 0.7 : 1,
    },
    buttonText: { color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: 0.4 },
    linkContainer: { marginTop: 25, flexDirection: 'row', justifyContent: 'center' },
    linkText: { fontSize: 15, color: isDarkMode ? '#bbb' : '#555' },
    linkAction: { fontWeight: '700', marginLeft: 6, color: isDarkMode ? '#4ea8de' : '#146c43' },
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: isDarkMode ? '#121212' : '#f8f9fa' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <Image source={require('../assets/wasteui.jpeg')} style={styles.logo} />

        <Text style={styles.label}>Collector ID</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., collector001"
          placeholderTextColor={isDarkMode ? '#888' : '#aaa'}
          value={collectorId}
          onChangeText={(v) => setCollectorId(normalizeCollectorId(v))}
          autoCapitalize="none"
          editable={!loading}
        />

        <Text style={styles.label}>Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Enter Password"
            placeholderTextColor={isDarkMode ? '#888' : '#aaa'}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!passwordVisible}
            editable={!loading}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={styles.passwordIcon}
            onPress={() => setPasswordVisible(!passwordVisible)}
            activeOpacity={0.7}
          >
            <Icon name={passwordVisible ? 'eye-off' : 'eye'} size={24} color={isDarkMode ? '#eee' : '#444'} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={handleCollectorLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>{loading ? 'Logging In...' : 'Login'}</Text>
        </TouchableOpacity>

        <View style={[styles.linkContainer, { marginTop: 25 }]}>
          <Text style={styles.linkText}>Not a collector?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('UsersLogin')}>
            <Text style={styles.linkAction}>Login as User</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
