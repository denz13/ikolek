// UsersLogin.js (username-as-uid; no uid field in Firestore doc)
import React, { useContext, useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image, Alert, ActivityIndicator, Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ThemeContext } from './ThemeContext';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebasecollector/firebase';
import { 
  signInAnonymously, 
  updateProfile, 
  signInWithPhoneNumber, 
  PhoneAuthProvider
} from 'firebase/auth';

const usernameRegex =
  /^(?=[a-zA-Z0-9._]{3,20}$)(?=.*[a-zA-Z])(?=.*[0-9])(?!.*[_.]{2})[^_.].*[^_.]$/;

const phoneRegex = /^09[0-9]{9}$/; // Philippine mobile number format

// Default sender phone number for OTP (change this to your preferred number)
const DEFAULT_SENDER_PHONE = '+639630646909'; // Change this to your default sender number

// SMS Service Configuration - Semaphore
const SMS_API_URL = 'https://api.semaphore.co/api/v4/messages'; // Semaphore API endpoint
const SMS_API_KEY = '8c72490f20c6640590098cee18e93ccf'; // Your Semaphore API key
const SMS_ENABLED = true; // Enable real SMS sending via Semaphore
const SHOW_OTP_IN_ALERT = true; // Always show OTP in alert for testing

// Function to send SMS using device's SMS app (opens SMS app with pre-filled message)
const sendSMSViaDevice = async (phoneNumber, message) => {
  try {
    // Import Linking from React Native
    const { Linking } = require('react-native');
    
    // Create SMS URL with pre-filled message
    const smsUrl = `sms:${phoneNumber}?body=${encodeURIComponent(message)}`;
    
    // Check if SMS app is available
    const canOpen = await Linking.canOpenURL(smsUrl);
    
    if (canOpen) {
      // Open SMS app with pre-filled message
      await Linking.openURL(smsUrl);
      return { success: true, method: 'device_sms' };
    } else {
      throw new Error('SMS app not available');
    }
  } catch (error) {
    console.error('Device SMS failed:', error);
    throw error;
  }
};

// Function to send SMS (you need to implement this with your SMS service)
const sendSMS = async (phoneNumber, message) => {
  // If SMS is not enabled, use device SMS app
  if (!SMS_ENABLED) {
    try {
      // Try to use device's SMS app first
      return await sendSMSViaDevice(phoneNumber, message);
    } catch (deviceError) {
      console.log('Device SMS failed, using simulation:', deviceError);
      return { success: true, simulated: true };
    }
  }

  try {
    // Semaphore API format
    const requestBody = {
      apikey: SMS_API_KEY,
      number: phoneNumber,
      message: message,
      // sendername: 'IKOLEK', // Removed - not valid in your Semaphore account
    };
    
    console.log('Sending to Semaphore:', {
      url: SMS_API_URL,
      body: requestBody
    });
    
    const response = await fetch(SMS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Semaphore API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('SMS sent successfully via Semaphore:', result);
    
    // Check if Semaphore returned an error in the response
    if (result && Array.isArray(result) && result.length > 0) {
      console.log('Semaphore response details:', result[0]);
      if (result[0].message && (result[0].message.includes('error') || result[0].message.includes('invalid'))) {
        throw new Error(`Semaphore error: ${result[0].message}`);
      }
    } else if (result && result.message) {
      console.log('Semaphore response message:', result.message);
      if (result.message.includes('error') || result.message.includes('invalid')) {
        throw new Error(`Semaphore error: ${result.message}`);
      }
    }
    
    return result;
  } catch (error) {
    console.error('SMS sending failed:', error);
    throw error;
  }
};

export default function UsersLogin() {
  const { isDarkMode } = useContext(ThemeContext);
  const navigation = useNavigation();
  const [userIdInput, setUserIdInput] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [currentStep, setCurrentStep] = useState(1); // 1: username, 2: phone, 3: OTP
  const [confirmationResult, setConfirmationResult] = useState(null);

  // OTP Timer countdown
  useEffect(() => {
    let interval = null;
    if (otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer(timer => timer - 1);
      }, 1000);
    } else if (otpTimer === 0) {
      setOtpSent(false);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  // Send OTP to phone number (Custom implementation for React Native)
  const sendFirebaseOTP = async (phone, username) => {
    try {
      // Format phone number for Semaphore (Philippines country code +63)
      const formattedPhone = `+63${phone.substring(1)}`;
      console.log('Sending SMS to:', formattedPhone);
      
      // Use the default sender phone number
      const defaultSenderPhone = DEFAULT_SENDER_PHONE;
      
      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store OTP in Firestore for verification (using users collection)
      await setDoc(doc(db, 'users', username), {
        phone_number: formattedPhone,
        sender_phone: defaultSenderPhone, // Store the sender number
        otp_code: otp,
        otp_status: 'pending',
        otp_created_at: serverTimestamp(),
        otp_expires_at: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes expiry
      }, { merge: true });

      // Also store OTP in register_phone_number collection
      const registerQuery = query(
        collection(db, 'register_phone_number'),
        where('users_id', '==', username)
      );
      const registerSnapshot = await getDocs(registerQuery);
      
      if (!registerSnapshot.empty) {
        const registerDoc = registerSnapshot.docs[0];
        await setDoc(doc(db, 'register_phone_number', registerDoc.id), {
          verification_code: otp,
          status: 'pending',
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      // Send real SMS using your backend/API
      // You need to create a backend endpoint to send SMS
      // For now, we'll show the OTP in alert for testing
      // In production, replace this with actual SMS sending
      
      try {
        // Send SMS (real or simulated)
        const smsMessage = `Your OTP is: ${otp}. Valid for 5 minutes. Do not share this code.`;
        const smsResult = await sendSMS(formattedPhone, smsMessage);
        
        if (smsResult.simulated) {
          // SMS is in simulation mode
          Alert.alert(
            'OTP Generated',
            `OTP generated for ${phone}. SMS service not configured yet.\n\nYour OTP is: ${otp}`,
            [{ text: 'OK' }]
          );
        } else if (smsResult.method === 'device_sms') {
          // Device SMS app opened
          Alert.alert(
            'SMS App Opened',
            `SMS app opened with OTP message for ${phone}. Please send the message using your phone's load.\n\nYour OTP is: ${otp}`,
            [{ text: 'OK' }]
          );
        } else {
          // Real SMS sent via Semaphore API
          const alertMessage = SHOW_OTP_IN_ALERT 
            ? `OTP sent via Semaphore to ${phone}. Please check your SMS messages.`
            : `OTP sent via Semaphore to ${phone}. Please check your SMS messages.`;
            
          Alert.alert(
            'OTP Sent',
            alertMessage,
            [{ text: 'OK' }]
          );
        }
      } catch (smsError) {
        console.error('SMS sending failed:', smsError);
        Alert.alert(
          'SMS Failed',
          `Failed to send SMS via Semaphore: ${smsError.message}\n\nFor testing: Your OTP is ${otp}`,
          [{ text: 'OK' }]
        );
      }

      // Create mock confirmation result for verification
      const mockConfirmation = {
        verificationId: `${username}_${Date.now()}`,
        confirm: async (code) => {
          // Verify OTP from users collection
          const userDoc = await getDoc(doc(db, 'users', username));
          
          if (!userDoc.exists()) {
            throw new Error('User not found');
          }

          const userData = userDoc.data();
          
          // Check if OTP matches and is pending
          if (userData.otp_code !== code || userData.otp_status !== 'pending') {
            throw new Error('Invalid OTP');
          }

          // Check if OTP is not expired
          const now = new Date();
          const expiresAt = userData.otp_expires_at?.toDate();

          if (expiresAt && now > expiresAt) {
            throw new Error('OTP Expired');
          }

          // Mark OTP as verified and set user status to active in users collection
          await setDoc(doc(db, 'users', username), {
            otp_status: 'verified',
            otp_verified_at: serverTimestamp(),
            status: 'active', // Set user status to active
            last_login: serverTimestamp(),
          }, { merge: true });

          // Also update register_phone_number collection with approved status
          const registerQuery = query(
            collection(db, 'register_phone_number'),
            where('users_id', '==', username)
          );
          const registerSnapshot = await getDocs(registerQuery);
          
          if (!registerSnapshot.empty) {
            const registerDoc = registerSnapshot.docs[0];
            await setDoc(doc(db, 'register_phone_number', registerDoc.id), {
              status: 'approved',
              verifiedAt: serverTimestamp(),
            }, { merge: true });
          }

          return {
            user: {
              uid: `phone_${formattedPhone.replace('+', '')}`,
              phoneNumber: formattedPhone
            }
          };
        }
      };
      
      setConfirmationResult(mockConfirmation);
      setOtpSent(true);
      setOtpTimer(300); // 5 minutes timer
      setCurrentStep(3);
    } catch (error) {
      console.error('Error sending OTP:', error);
      Alert.alert('Error', 'Failed to send OTP. Please try again.');
    }
  };

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
      // Check if user exists in register_phone_number collection
      const q = query(
        collection(db, 'register_phone_number'),
        where('users_id', '==', username)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // User exists in register_phone_number collection
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        // setUserData(userData); // Removed - function doesn't exist
        
        // Check if user status is approved
        if (userData.status === 'approved') {
          // User is already approved, proceed directly to login
          Alert.alert(
            'Welcome Back!',
            'Your account is already approved. Proceeding to login...',
            [{ 
              text: 'OK', 
              onPress: () => {
                // Navigate directly to main app
                navigation.navigate('UsersTabs');
              }
            }]
          );
        } else {
          // User exists but not approved, proceed to phone number step for verification
          setCurrentStep(2);
        }
      } else {
        // User doesn't exist in register_phone_number, proceed to phone number step for registration
        setCurrentStep(2);
      }
    } catch (error) {
      console.error('Error checking user status:', error);
      Alert.alert('Error', 'Failed to check user status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSubmit = async () => {
    const phone = phoneNumber.trim();

    if (!phone) {
      return Alert.alert('Missing Phone Number', 'Please enter your phone number.');
    }
    if (!phoneRegex.test(phone)) {
      return Alert.alert(
        'Invalid Phone Number',
        'Please enter a valid Philippine mobile number (09XXXXXXXXX).'
      );
    }

    setLoading(true);
    try {
      const username = userIdInput.trim();
      
      // Check if user exists in users collection
      const userRef = doc(db, 'users', username);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        await setDoc(userRef, {
          userId: username,
          role: 'user',
          status: 'pending', // Set to pending until OTP verification
          phoneNumber: phone,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(userRef, { 
          phoneNumber: phone,
          status: 'pending', // Reset to pending for re-verification
          updatedAt: serverTimestamp() 
        }, { merge: true });
      }

      // Create or update register_phone_number collection
      const registerQuery = query(
        collection(db, 'register_phone_number'),
        where('users_id', '==', username)
      );
      const registerSnapshot = await getDocs(registerQuery);
      
      if (registerSnapshot.empty) {
        // Create new entry in register_phone_number
        await setDoc(doc(db, 'register_phone_number', `${username}_${Date.now()}`), {
          users_id: username,
          phone_number: phone,
          status: 'pending',
          verification_code: '', // Will be set when OTP is sent
          createdAt: serverTimestamp(),
        });
      } else {
        // Update existing entry
        const registerDoc = registerSnapshot.docs[0];
        await setDoc(doc(db, 'register_phone_number', registerDoc.id), {
          phone_number: phone,
          status: 'pending', // Reset to pending for re-verification
          verification_code: '', // Will be set when OTP is sent
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      // Send Firebase OTP
      await sendFirebaseOTP(phone, username);
    } catch (error) {
      console.error('Error processing phone number:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOTPVerify = async () => {
    const otp = otpCode.trim();
    const username = userIdInput.trim();

    if (!otp) {
      return Alert.alert('Missing OTP', 'Please enter the OTP code.');
    }
    if (otp.length !== 6) {
      return Alert.alert('Invalid OTP', 'Please enter a valid 6-digit OTP code.');
    }

    if (!confirmationResult) {
      Alert.alert('Error', 'No OTP session found. Please request a new OTP.');
      return;
    }

    setLoading(true);
    try {
      // Verify OTP using Firebase
      const userCredential = await confirmationResult.confirm(otp);
      
      // User is now signed in with phone number
      const user = userCredential.user;
      
      // Update user profile with username (commented out due to error)
      // try {
      //   await updateProfile(user, { displayName: username });
      // } catch (e) {
      //   console.log('Could not update profile:', e);
      // }

      // Store/update user data in Firestore
      const userRef = doc(db, 'users', username);
      await setDoc(userRef, {
        userId: username,
        role: 'user',
        status: 'active',
        phoneNumber: phoneNumber.trim(),
        uid: user.uid,
        updatedAt: serverTimestamp(),
        last_login: serverTimestamp(),
      }, { merge: true });

      // Show success message
      Alert.alert(
        'Verification Successful!',
        'Your account has been verified and activated. You can now login directly next time.',
        [{ 
          text: 'OK', 
          onPress: () => {
            // Navigate to main app
            navigation.navigate('UsersTabs', { uid: username, userId: username });
          }
        }]
      );
    } catch (error) {
      console.error('OTP verification error:', error);
      
      let errorMessage = 'Failed to verify OTP. Please try again.';
      
      if (error.code === 'auth/invalid-verification-code') {
        errorMessage = 'Invalid OTP code. Please check and try again.';
      } else if (error.code === 'auth/code-expired') {
        errorMessage = 'OTP code has expired. Please request a new one.';
      } else if (error.code === 'auth/session-expired') {
        errorMessage = 'Session expired. Please request a new OTP.';
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setOtpCode('');
    setConfirmationResult(null);
    await sendFirebaseOTP(phoneNumber.trim(), userIdInput.trim());
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
    subLabel: {
      fontSize: 14,
      color: isDarkMode ? '#aaa' : '#666',
      marginBottom: 8,
      textAlign: 'center',
    },
    backButton: {
      marginTop: 15,
      paddingVertical: 10,
      alignItems: 'center',
    },
    backButtonText: {
      color: isDarkMode ? '#80bdff' : '#146c43',
      fontSize: 14,
      fontWeight: '600',
    },
    timerText: {
      fontSize: 14,
      color: isDarkMode ? '#aaa' : '#666',
      textAlign: 'center',
      marginBottom: 10,
    },
    resendButton: {
      marginTop: 10,
      paddingVertical: 10,
      alignItems: 'center',
    },
    resendButtonDisabled: {
      opacity: 0.5,
    },
    resendButtonText: {
      color: isDarkMode ? '#80bdff' : '#146c43',
      fontSize: 14,
      fontWeight: '600',
    },
    resendButtonTextDisabled: {
      color: isDarkMode ? '#666' : '#999',
    },
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <Image source={require('../assets/wasteui.jpeg')} style={styles.logo} />
      

      {/* Step 1: Username */}
      {currentStep === 1 && (
        <>
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
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Next</Text>}
          </TouchableOpacity>
        </>
      )}

      {/* Step 2: Phone Number */}
      {currentStep === 2 && (
        <>
          <Text style={styles.label}>Phone Number</Text>
          <Text style={styles.subLabel}>Enter your Philippine mobile number</Text>
          <TextInput
            style={styles.input}
            placeholder="09XXXXXXXXX"
            placeholderTextColor={isDarkMode ? '#aaa' : '#888'}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            editable={!loading}
            keyboardType="phone-pad"
            maxLength={11}
          />

          <TouchableOpacity style={styles.button} onPress={handlePhoneSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send OTP</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.backButton} onPress={() => setCurrentStep(1)}>
            <Text style={styles.backButtonText}>← Back to Username</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Step 3: OTP Verification */}
      {currentStep === 3 && (
        <>
          <Text style={styles.label}>Enter OTP Code</Text>
          <Text style={styles.subLabel}>We sent a 6-digit code to {phoneNumber}</Text>
          <TextInput
            style={styles.input}
            placeholder="000000"
            placeholderTextColor={isDarkMode ? '#aaa' : '#888'}
            value={otpCode}
            onChangeText={setOtpCode}
            editable={!loading}
            keyboardType="number-pad"
            maxLength={6}
            textAlign="center"
            fontSize={24}
          />

          {otpTimer > 0 && (
            <Text style={styles.timerText}>
              Resend OTP in {formatTimer(otpTimer)}
            </Text>
          )}

          <TouchableOpacity style={styles.button} onPress={handleOTPVerify} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify OTP</Text>}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.resendButton, otpTimer > 0 && styles.resendButtonDisabled]} 
            onPress={handleResendOTP} 
            disabled={otpTimer > 0 || loading}
          >
            <Text style={[styles.resendButtonText, otpTimer > 0 && styles.resendButtonTextDisabled]}>
              Resend OTP
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.backButton} onPress={() => setCurrentStep(2)}>
            <Text style={styles.backButtonText}>← Back to Phone Number</Text>
          </TouchableOpacity>
        </>
      )}

      <View style={styles.signupContainer}>
        <Text style={styles.signupText}>Not a User?</Text>
        <TouchableOpacity onPress={() => navigation.navigate('CollectorsLogin')}>
          <Text style={styles.signupLink}>Login as Collector</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
