// Reports.js — username-as-uid + Zone input + Camera only + 100MB check

import React, { useState, useContext, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { ThemeContext } from './ThemeContext';
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged } from 'firebase/auth';
import { db, storage, auth } from '../firebasecollector/firebase';
import uuid from 'react-native-uuid';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export default function Reports({ route, navigation }) {
  const { isDarkMode } = useContext(ThemeContext);

  // Username-as-uid (route param -> auth.displayName -> null)
  const routeUser = route?.params?.uid || route?.params?.userId || null;
  const displayNameUser = auth?.currentUser?.displayName || null;
  const username = useMemo(
    () => routeUser || displayNameUser || null,
    [routeUser, displayNameUser]
  );

  const initialZone = route?.params?.zone || '';

  const [details, setDetails] = useState('');
  const [zone, setZone] = useState(initialZone);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState([]);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const unsubAuth = onAuthStateChanged(auth, () => {});
    return () => {
      mounted.current = false;
      if (unsubAuth) unsubAuth();
    };
  }, []);

  // Ask for permissions once
  useEffect(() => {
    (async () => {
      try {
        const cam = await ImagePicker.requestCameraPermissionsAsync();
        if (cam.status !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Camera access is required to take photos.'
          );
        }
        if (Platform.OS === 'ios') {
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        }
      } catch {}
    })();
  }, []);

  // Live query of this username's reports
  useEffect(() => {
    if (!username) {
      setReports([]);
      return;
    }
    const q = query(collection(db, 'reports'), where('userId', '==', username));
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!mounted.current) return;
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        data.sort((a, b) => {
          const ta = a?.submittedAt?.toMillis ? a.submittedAt.toMillis() : 0;
          const tb = b?.submittedAt?.toMillis ? b.submittedAt.toMillis() : 0;
          return tb - ta;
        });
        setReports(data);
      },
      (err) => console.error('onSnapshot error:', err)
    );
    return () => unsub();
  }, [username]);

  // Camera only
  const captureImage = async () => {
    if (images.length >= 5) {
      Alert.alert('Limit Reached', 'You can only attach up to 5 images.');
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        const uri = result.assets[0].uri;
        const info = await FileSystem.getInfoAsync(uri);

        if (info.size > MAX_FILE_SIZE) {
          Alert.alert(
            'File too large',
            'Please capture an image smaller than 100MB.'
          );
          return;
        }

        setImages((prev) => [...prev, uri]);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to access the camera.');
    }
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadOne = async (uri, user) => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const imageId = uuid.v4();
    const objectRef = ref(storage, `reports/${user}/${imageId}.jpg`);
    await uploadBytes(objectRef, blob);
    return await getDownloadURL(objectRef);
  };

  const uploadImagesAndSubmit = async () => {
    if (!details.trim()) {
      Alert.alert('Missing Info', 'Please enter report details.');
      return;
    }
    if (!zone.trim()) {
      Alert.alert('Missing Zone', 'Please enter the zone for this report.');
      return;
    }
    if (!username) {
      Alert.alert('Authentication Required', 'Please log in first.', [
        { text: 'Go to Login', onPress: () => navigation?.replace?.('UsersLogin') },
      ]);
      return;
    }

    setLoading(true);
    try {
      const uploadedUrls = [];
      for (const uri of images) {
        const url = await uploadOne(uri, username);
        uploadedUrls.push(url);
      }

      await addDoc(collection(db, 'reports'), {
        userId: username,
        messages: details.trim(),
        zone: zone.trim(),
        images: uploadedUrls,
        submittedAt: serverTimestamp(),
        status: 'pending',
        response: '',
      });

      Alert.alert('Success', 'Report submitted successfully!');
      setDetails('');
      setZone('');
      setImages([]);
    } catch (error) {
      console.error('Submission error:', error);
      Alert.alert('Error', 'Failed to submit report.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  const themeStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? '#121212' : '#f9f9f9',
      paddingHorizontal: 20,
    },
    header: {
      paddingTop: 50,
      paddingBottom: 15,
      backgroundColor: isDarkMode ? '#121212' : '#f9f9f9',
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: isDarkMode ? '#fff' : '#222',
      alignSelf: 'center',
    },
    label: {
      color: isDarkMode ? '#aaa' : '#444',
      marginBottom: 8,
      fontSize: 15,
      fontWeight: '500',
    },
    input: {
      backgroundColor: isDarkMode ? '#1E1E1E' : '#fff',
      color: isDarkMode ? '#fff' : '#000',
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 15,
      borderWidth: 1,
      borderColor: isDarkMode ? '#333' : '#ddd',
    },
    imagePreview: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginVertical: 10,
    },
    thumb: {
      width: 90,
      height: 90,
      borderRadius: 10,
      marginRight: 10,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: isDarkMode ? '#333' : '#ddd',
    },
    button: {
      backgroundColor: '#4CAF50',
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center',
      marginBottom: 12,
      elevation: 2,
    },
    buttonText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 16,
    },
    uploadBtn: {
      backgroundColor: '#388E3C',
    },
    card: {
      marginBottom: 20,
      backgroundColor: isDarkMode ? '#1e1e1e' : '#fff',
      padding: 16,
      borderRadius: 12,
      elevation: 2,
    },
    cardTitle: {
      fontWeight: '700',
      fontSize: 15,
      color: isDarkMode ? '#fff' : '#000',
      marginBottom: 4,
    },
    cardMessage: {
      color: isDarkMode ? '#ccc' : '#444',
      marginBottom: 6,
    },
    status: {
      alignSelf: 'flex-start',
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 12,
      fontWeight: '600',
      fontSize: 13,
      marginTop: 5,
    },
    response: {
      marginTop: 10,
      padding: 10,
      backgroundColor: isDarkMode ? '#2a2a2a' : '#e8f5e9',
      borderRadius: 8,
      color: isDarkMode ? '#81c784' : '#2e7d32',
    },
    metaRow: {
      marginBottom: 6,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    metaText: {
      color: isDarkMode ? '#bbb' : '#666',
      fontSize: 12,
    },
  });

  return (
    <View style={themeStyles.container}>
      <View style={themeStyles.header}>
        <Text style={themeStyles.title}>Submit Report</Text>
        {!!username && (
          <Text
            style={{
              textAlign: 'center',
              marginTop: 6,
              color: isDarkMode ? '#bbb' : '#444',
            }}
          >
            Logged in as <Text style={{ fontWeight: '700' }}>{username}</Text>
          </Text>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Zone input */}
        <Text style={themeStyles.label}>Zone</Text>
        <TextInput
          placeholder="e.g., Zone 3 - Poblacion"
          placeholderTextColor={isDarkMode ? '#888' : '#999'}
          style={themeStyles.input}
          value={zone}
          onChangeText={setZone}
          autoCapitalize="words"
          autoCorrect={false}
        />

        <Text style={themeStyles.label}>Report Details</Text>
        <TextInput
          placeholder="Enter report details"
          placeholderTextColor={isDarkMode ? '#888' : '#999'}
          style={[themeStyles.input, { height: 100, textAlignVertical: 'top' }]}
          multiline
          value={details}
          onChangeText={setDetails}
        />

        <TouchableOpacity
          style={[themeStyles.button, themeStyles.uploadBtn]}
          onPress={captureImage}
        >
          <Text style={themeStyles.buttonText}>Capture Photo (max 5, ≤100MB)</Text>
        </TouchableOpacity>

        {images.length > 0 && (
          <View style={themeStyles.imagePreview}>
            {images.map((uri, index) => (
              <TouchableOpacity key={index} onLongPress={() => removeImage(index)}>
                <Image source={{ uri }} style={themeStyles.thumb} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {loading ? (
          <ActivityIndicator size="large" color="#4CAF50" />
        ) : (
          <TouchableOpacity style={themeStyles.button} onPress={uploadImagesAndSubmit}>
            <Text style={themeStyles.buttonText}>Submit Report</Text>
          </TouchableOpacity>
        )}

        <Text style={[themeStyles.title, { marginTop: 30 }]}>Your Previous Reports</Text>

        {reports.length > 0 ? (
          reports.map((report) => (
            <View key={report.id} style={themeStyles.card}>
              <View style={themeStyles.metaRow}>
                <Text style={themeStyles.cardTitle}>Report</Text>
                <Text style={themeStyles.metaText}>
                  {report.submittedAt?.toDate?.()
                    ? report.submittedAt.toDate().toLocaleString()
                    : '—'}
                </Text>
              </View>

              <Text style={themeStyles.metaText}>
                Zone: {report.zone?.length ? report.zone : '—'}
              </Text>

              <Text style={themeStyles.cardMessage}>
                Message: {report.messages}
              </Text>

              <Text
                style={[
                  themeStyles.status,
                  {
                    backgroundColor:
                      report.status === 'pending'
                        ? '#ffe082'
                        : report.status === 'approved'
                        ? '#c8e6c9'
                        : '#ffcdd2',
                    color:
                      report.status === 'pending'
                        ? '#f57f17'
                        : report.status === 'approved'
                        ? '#2e7d32'
                        : '#c62828',
                  },
                ]}
              >
                {(report.status || 'pending').toUpperCase()}
              </Text>

              {report.response ? (
                <Text style={themeStyles.response}>💬 {report.response}</Text>
              ) : (
                <Text style={{ color: '#999', marginTop: 10 }}>
                  ⏳ Awaiting response...
                </Text>
              )}

              <ScrollView
                horizontal
                style={{ marginTop: 10 }}
                showsHorizontalScrollIndicator={false}
              >
                {Array.isArray(report.images) &&
                  report.images.map((url, i) => (
                    <Image
                      key={`${report.id}-${i}`}
                      source={{ uri: url }}
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: 8,
                        marginRight: 8,
                      }}
                    />
                  ))}
              </ScrollView>
            </View>
          ))
        ) : (
          <Text
            style={{
              color: isDarkMode ? '#888' : '#555',
              textAlign: 'center',
              marginTop: 20,
            }}
          >
            No reports submitted yet.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
