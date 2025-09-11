import React, { useContext, useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, Modal, TextInput, ScrollView,
} from 'react-native';
import { ThemeContext } from './ThemeContext';
import { db } from '../firebasecollector/firebase';
import {
  collection, serverTimestamp, addDoc, getDocs, query, where, orderBy,
} from 'firebase/firestore';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { responsive, wp, hp, fp, rp, isTablet, isSmallDevice } from '../utils/responsive';

export default function CollectionScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { collectorId } = route.params || {};

  const { isDarkMode } = useContext(ThemeContext);

  const [loading, setLoading] = useState(false);
  
  // Report modal states
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportType, setReportType] = useState('');
  const [reportMessage, setReportMessage] = useState('');
  const [maintenanceDate, setMaintenanceDate] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [submittedReports, setSubmittedReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);

  const reportTypes = [
    'Vehicle Exterior',
    'Engine & Mechanical', 
    'Preventive Maintenance',
    'Interior',
    'Emergency Repairs',
    'Other'
  ];


  // Report submission functions
  const openReportModal = () => {
    setShowReportModal(true);
    setReportType('');
    setReportMessage('');
    setMaintenanceDate('');
    setShowDropdown(false);
  };

  const closeReportModal = () => {
    setShowReportModal(false);
    setReportType('');
    setReportMessage('');
    setMaintenanceDate('');
    setShowDropdown(false);
  };

  const selectReportType = (type) => {
    setReportType(type);
    setShowDropdown(false);
  };

  // Fetch reports when component loads
  useEffect(() => {
    if (collectorId) {
      fetchSubmittedReports();
    }
  }, [collectorId]);

  // Fetch submitted reports for this collector
  const fetchSubmittedReports = async () => {
    if (!collectorId) return;
    
    try {
      setLoadingReports(true);
      const reportsQuery = query(
        collection(db, 'collector_reports'),
        where('collectorId', '==', collectorId)
      );
      
      const snapshot = await getDocs(reportsQuery);
      const reports = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(),
      }));
      
      // Sort by createdAt in descending order (newest first)
      const sortedReports = reports.sort((a, b) => b.createdAt - a.createdAt);
      
      setSubmittedReports(sortedReports);
      setLoadingReports(false);
    } catch (error) {
      console.error('Error fetching submitted reports:', error);
      setLoadingReports(false);
    }
  };

  const submitReport = async () => {
    if (!reportType.trim()) {
      Alert.alert('Error', 'Please select a report type.');
      return;
    }

    if (!reportMessage.trim()) {
      Alert.alert('Error', 'Please enter a report message.');
      return;
    }

    if (!maintenanceDate.trim()) {
      Alert.alert('Error', 'Please enter the maintenance date.');
      return;
    }

    setSubmittingReport(true);
    try {
      const reportData = {
        collectorId: collectorId || '',
        reporttype: reportType,
        reportMessage: reportMessage.trim(),
        maintenanceDate: maintenanceDate.trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'collector_reports'), reportData);

      Alert.alert(
        'Report Submitted',
        'Your report has been submitted successfully.',
        [{ text: 'OK', onPress: () => {
          closeReportModal();
          setReportSubmitted(true);
          fetchSubmittedReports(); // Refresh the reports list
        }}]
      );
    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setSubmittingReport(false);
    }
  };


  const iconColor = isDarkMode ? "#fff" : "#333";

  // Render individual report item
  const renderReportItem = ({ item }) => {
    const getStatusColor = (status) => {
      switch (status) {
        case 'pending': return '#FF9800';
        case 'approved': return '#4CAF50';
        case 'rejected': return '#F44336';
        default: return '#666';
      }
    };

    const getStatusIcon = (status) => {
      switch (status) {
        case 'pending': return 'time';
        case 'approved': return 'checkmark-circle';
        case 'rejected': return 'close-circle';
        default: return 'help-circle';
      }
    };

    return (
      <View style={[styles.reportItem, isDarkMode && styles.darkReportItem]}>
        <View style={styles.reportHeader}>
          <View style={styles.reportTypeContainer}>
            <Ionicons name="document-text" size={16} color="#4CAF50" />
            <Text style={[styles.reportTypeText, isDarkMode && styles.darkText]}>
              {item.reporttype}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <Ionicons name={getStatusIcon(item.status)} size={14} color={getStatusColor(item.status)} />
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status?.toUpperCase() || 'UNKNOWN'}
            </Text>
          </View>
        </View>
        
        <Text style={[styles.reportMessage, isDarkMode && styles.darkText]}>
          {item.reportMessage}
        </Text>
        
        <View style={styles.reportFooter}>
          <View style={styles.reportDateContainer}>
            <Ionicons name="calendar" size={14} color="#666" />
            <Text style={[styles.reportDate, isDarkMode && styles.darkText]}>
              {item.maintenanceDate}
            </Text>
          </View>
          <Text style={[styles.reportTime, isDarkMode && styles.darkText]}>
            {item.createdAt.toLocaleDateString()} {item.createdAt.toLocaleTimeString()}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, isDarkMode && styles.darkContainer]}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={responsive.iconSize.lg} color={iconColor} />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={[styles.headerTitle, isDarkMode && styles.darkText]}>
            Submit Report
          </Text>
        </View>
        <TouchableOpacity onPress={openReportModal} style={styles.reportButton}>
          <Ionicons name="document-text" size={responsive.iconSize.lg} color={iconColor} />
        </TouchableOpacity>
      </View>

      <View style={styles.contentContainer}>
        {/* Submit Report Section - Only show if no reports or just submitted */}
        {(submittedReports.length === 0 || reportSubmitted) && (
          <View style={styles.submitSection}>
            {!reportSubmitted ? (
              <>
                <Text style={[styles.description, isDarkMode && styles.darkText]}>
                  Submit maintenance reports or report issues with your assigned equipment.
                </Text>
                <TouchableOpacity
                  onPress={openReportModal}
                  style={[styles.submitButton, isDarkMode && styles.darkSubmitButton]}
                >
                  <Ionicons name="document-text" size={24} color="#fff" />
                  <Text style={styles.submitButtonText}>Submit Report</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.successContainer}>
                  <Ionicons name="checkmark-circle" size={60} color="#4CAF50" />
                  <Text style={[styles.successTitle, isDarkMode && styles.darkText]}>
                    Report Submitted Successfully!
                  </Text>
                  <Text style={[styles.successMessage, isDarkMode && styles.darkText]}>
                    Your maintenance report has been submitted and is now pending review.
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={openReportModal}
                  style={[styles.submitAnotherButton, isDarkMode && styles.darkSubmitAnotherButton]}
                >
                  <Ionicons name="add-circle" size={24} color="#4CAF50" />
                  <Text style={styles.submitAnotherButtonText}>Submit Another Report</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Submitted Reports Section */}
        <View style={styles.reportsSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>
              My Submitted Reports ({submittedReports.length})
            </Text>
            {/* {submittedReports.length > 0 && (
              <TouchableOpacity
                onPress={openReportModal}
                style={[styles.addReportButton, isDarkMode && styles.darkAddReportButton]}
              >
                <Ionicons name="add" size={20} color="#4CAF50" />
                <Text style={styles.addReportButtonText}>New Report</Text>
              </TouchableOpacity>
            )} */}
          </View>
          
          {loadingReports ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, isDarkMode && styles.darkText]}>
                Loading reports...
              </Text>
            </View>
          ) : submittedReports.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-outline" size={48} color="#999" />
              <Text style={[styles.emptyText, isDarkMode && styles.darkText]}>
                No reports submitted yet
              </Text>
            </View>
          ) : (
            <ScrollView 
              style={styles.reportsList}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: responsive.spacing.xl }}
            >
              {submittedReports.map((report) => (
                <View key={report.id}>
                  {renderReportItem({ item: report })}
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>

      {/* Report Modal */}
      <Modal
        visible={showReportModal}
        transparent={true}
        animationType="fade"
        onRequestClose={closeReportModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && styles.darkModalContent]}>
            <Text style={[styles.modalTitle, isDarkMode && styles.darkText]}>
              Submit Report
            </Text>
            
            {/* Report Type Selection */}
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, isDarkMode && styles.darkText]}>
                Report Type
              </Text>
              <TouchableOpacity
                style={[styles.dropdownButton, isDarkMode && styles.darkDropdownButton]}
                onPress={() => setShowDropdown(!showDropdown)}
              >
                <Text style={[
                  styles.dropdownButtonText,
                  !reportType && styles.placeholderText,
                  isDarkMode && styles.darkText,
                ]}>
                  {reportType || 'Select report type...'}
                </Text>
                <Ionicons 
                  name={showDropdown ? "chevron-up" : "chevron-down"} 
                  size={20} 
                  color={isDarkMode ? "#fff" : "#333"} 
                />
              </TouchableOpacity>
              
              {showDropdown && (
                <View style={[styles.dropdownList, isDarkMode && styles.darkDropdownList]}>
                  <ScrollView style={styles.dropdownScrollView} showsVerticalScrollIndicator={false}>
                    {reportTypes.map((type, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.dropdownItem,
                          reportType === type && styles.selectedDropdownItem,
                          isDarkMode && styles.darkDropdownItem,
                        ]}
                        onPress={() => selectReportType(type)}
                      >
                        <Text style={[
                          styles.dropdownItemText,
                          reportType === type && styles.selectedDropdownItemText,
                          isDarkMode && styles.darkText,
                        ]}>
                          {type}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Maintenance Date */}
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, isDarkMode && styles.darkText]}>
                Maintenance Date
              </Text>
              <TextInput
                style={[styles.textInput, isDarkMode && styles.darkTextInput]}
                value={maintenanceDate}
                onChangeText={setMaintenanceDate}
                placeholder="Enter maintenance date (e.g., 2024-01-15)"
                placeholderTextColor={isDarkMode ? '#888' : '#999'}
              />
            </View>

            {/* Report Message */}
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, isDarkMode && styles.darkText]}>
                Report Message
              </Text>
              <TextInput
                style={[styles.textArea, isDarkMode && styles.darkTextInput]}
                value={reportMessage}
                onChangeText={setReportMessage}
                placeholder="Describe the issue or maintenance needed..."
                placeholderTextColor={isDarkMode ? '#888' : '#999'}
                multiline={true}
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Modal Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={closeReportModal}
                disabled={submittingReport}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={submitReport}
                disabled={submittingReport}
              >
                <Text style={styles.modalButtonText}>
                  {submittingReport ? 'Submitting...' : 'Submit Report'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: responsive.spacing.xl,
    paddingTop: responsive.spacing['4xl'],
    backgroundColor: '#fff',
    ...(isTablet() && {
      paddingHorizontal: responsive.spacing['3xl'],
      paddingTop: responsive.spacing['5xl'],
    }),
  },
  darkContainer: {
    backgroundColor: '#121212',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsive.spacing.xl,
    position: 'relative',
    height: responsive.spacing['4xl'],
    ...(isTablet() && {
      marginBottom: responsive.spacing['2xl'],
      height: responsive.spacing['5xl'],
    }),
  },
  titleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportButton: {
    position: 'absolute',
    right: 0,
    padding: responsive.spacing.base,
    ...(isTablet() && { padding: responsive.spacing.lg }),
  },
  headerTitle: {
    fontSize: responsive.fontSize['2xl'],
    fontWeight: 'bold',
    color: '#333',
    ...(isSmallDevice() && { fontSize: responsive.fontSize.xl }),
    ...(isTablet() && { fontSize: responsive.fontSize['3xl'] }),
  },
  darkText: {
    color: '#fff',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: responsive.spacing.xl,
    ...(isTablet() && { paddingHorizontal: responsive.spacing['3xl'] }),
  },
  submitSection: {
    alignItems: 'center',
    paddingVertical: responsive.spacing.xl,
    ...(isTablet() && { paddingVertical: responsive.spacing['2xl'] }),
  },
  reportsSection: {
    flex: 1,
    marginTop: responsive.spacing.lg,
    ...(isTablet() && { marginTop: responsive.spacing.xl }),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.spacing.lg,
    ...(isTablet() && { marginBottom: responsive.spacing.xl }),
  },
  sectionTitle: {
    fontSize: responsive.fontSize.lg,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    ...(isTablet() && { fontSize: responsive.fontSize.xl }),
  },
  addReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#4CAF50',
    paddingVertical: responsive.spacing.sm,
    paddingHorizontal: responsive.spacing.base,
    borderRadius: responsive.borderRadius.base,
    gap: responsive.spacing.xs,
    ...(isTablet() && {
      paddingVertical: responsive.spacing.base,
      paddingHorizontal: responsive.spacing.lg,
      borderRadius: responsive.borderRadius.lg,
    }),
  },
  darkAddReportButton: {
    borderColor: '#2E7D32',
  },
  addReportButtonText: {
    color: '#4CAF50',
    fontSize: responsive.fontSize.sm,
    fontWeight: 'bold',
    ...(isTablet() && { fontSize: responsive.fontSize.base }),
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: responsive.spacing['2xl'],
  },
  loadingText: {
    fontSize: responsive.fontSize.base,
    color: '#666',
    ...(isTablet() && { fontSize: responsive.fontSize.lg }),
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: responsive.spacing['3xl'],
  },
  emptyText: {
    fontSize: responsive.fontSize.base,
    color: '#999',
    marginTop: responsive.spacing.base,
    ...(isTablet() && { fontSize: responsive.fontSize.lg }),
  },
  reportsList: {
    flex: 1,
  },
  reportItem: {
    backgroundColor: '#fff',
    borderRadius: responsive.borderRadius.lg,
    padding: responsive.spacing.lg,
    marginBottom: responsive.spacing.base,
    borderLeftWidth: rp(4),
    borderLeftColor: '#4CAF50',
    ...(isTablet() && {
      borderRadius: responsive.borderRadius.xl,
      padding: responsive.spacing.xl,
      marginBottom: responsive.spacing.lg,
      borderLeftWidth: rp(6),
    }),
  },
  darkReportItem: {
    backgroundColor: '#1E1E1E',
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.spacing.base,
  },
  reportTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reportTypeText: {
    fontSize: responsive.fontSize.base,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: responsive.spacing.xs,
    ...(isTablet() && { fontSize: responsive.fontSize.lg }),
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsive.spacing.base,
    paddingVertical: responsive.spacing.xs,
    borderRadius: responsive.borderRadius.base,
    gap: responsive.spacing.xs,
    ...(isTablet() && {
      paddingHorizontal: responsive.spacing.lg,
      paddingVertical: responsive.spacing.sm,
      borderRadius: responsive.borderRadius.lg,
    }),
  },
  statusText: {
    fontSize: responsive.fontSize.sm,
    fontWeight: 'bold',
    ...(isTablet() && { fontSize: responsive.fontSize.base }),
  },
  reportMessage: {
    fontSize: responsive.fontSize.base,
    color: '#666',
    lineHeight: 20,
    marginBottom: responsive.spacing.base,
    ...(isTablet() && { 
      fontSize: responsive.fontSize.lg,
      lineHeight: 24,
      marginBottom: responsive.spacing.lg,
    }),
  },
  reportFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reportDate: {
    fontSize: responsive.fontSize.sm,
    color: '#666',
    marginLeft: responsive.spacing.xs,
    ...(isTablet() && { fontSize: responsive.fontSize.base }),
  },
  reportTime: {
    fontSize: responsive.fontSize.sm,
    color: '#999',
    ...(isTablet() && { fontSize: responsive.fontSize.base }),
  },
  description: {
    fontSize: responsive.fontSize.lg,
    color: '#666',
    textAlign: 'center',
    marginBottom: responsive.spacing['3xl'],
    lineHeight: 24,
    ...(isTablet() && { 
      fontSize: responsive.fontSize.xl,
      marginBottom: responsive.spacing['4xl'],
      lineHeight: 28,
    }),
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: responsive.spacing.xl,
    paddingHorizontal: responsive.spacing['2xl'],
    borderRadius: responsive.borderRadius.lg,
    gap: responsive.spacing.base,
    ...(isTablet() && {
      paddingVertical: responsive.spacing['2xl'],
      paddingHorizontal: responsive.spacing['3xl'],
      borderRadius: responsive.borderRadius.xl,
      gap: responsive.spacing.lg,
    }),
  },
  darkSubmitButton: {
    backgroundColor: '#2E7D32',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: responsive.fontSize.lg,
    fontWeight: 'bold',
    ...(isTablet() && { fontSize: responsive.fontSize.xl }),
  },
  successContainer: {
    alignItems: 'center',
    marginBottom: responsive.spacing['3xl'],
    ...(isTablet() && { marginBottom: responsive.spacing['4xl'] }),
  },
  successTitle: {
    fontSize: responsive.fontSize.xl,
    fontWeight: 'bold',
    color: '#333',
    marginTop: responsive.spacing.lg,
    marginBottom: responsive.spacing.base,
    textAlign: 'center',
    ...(isTablet() && { 
      fontSize: responsive.fontSize['2xl'],
      marginTop: responsive.spacing.xl,
      marginBottom: responsive.spacing.lg,
    }),
  },
  successMessage: {
    fontSize: responsive.fontSize.base,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: responsive.spacing.lg,
    ...(isTablet() && { 
      fontSize: responsive.fontSize.lg,
      lineHeight: 26,
      paddingHorizontal: responsive.spacing.xl,
    }),
  },
  submitAnotherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#4CAF50',
    paddingVertical: responsive.spacing.lg,
    paddingHorizontal: responsive.spacing.xl,
    borderRadius: responsive.borderRadius.lg,
    gap: responsive.spacing.base,
    ...(isTablet() && {
      paddingVertical: responsive.spacing.xl,
      paddingHorizontal: responsive.spacing['2xl'],
      borderRadius: responsive.borderRadius.xl,
      gap: responsive.spacing.lg,
    }),
  },
  darkSubmitAnotherButton: {
    borderColor: '#2E7D32',
  },
  submitAnotherButtonText: {
    color: '#4CAF50',
    fontSize: responsive.fontSize.base,
    fontWeight: 'bold',
    ...(isTablet() && { fontSize: responsive.fontSize.lg }),
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: responsive.borderRadius.lg,
    padding: responsive.spacing.xl,
    margin: responsive.spacing.xl,
    minWidth: rp(300),
    maxWidth: rp(400),
    ...(isTablet() && {
      borderRadius: responsive.borderRadius.xl,
      padding: responsive.spacing['2xl'],
      margin: responsive.spacing['2xl'],
      minWidth: rp(400),
      maxWidth: rp(500),
    }),
  },
  darkModalContent: {
    backgroundColor: '#1E1E1E',
  },
  modalTitle: {
    fontSize: responsive.fontSize.lg,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: responsive.spacing.lg,
    textAlign: 'center',
    ...(isTablet() && { fontSize: responsive.fontSize.xl }),
  },
  inputContainer: {
    marginBottom: responsive.spacing.lg,
    ...(isTablet() && { marginBottom: responsive.spacing.xl }),
  },
  inputLabel: {
    fontSize: responsive.fontSize.base,
    color: '#555',
    marginBottom: responsive.spacing.base,
    fontWeight: '600',
    ...(isTablet() && { fontSize: responsive.fontSize.lg }),
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: responsive.borderRadius.base,
    padding: responsive.spacing.lg,
    backgroundColor: '#fff',
    ...(isTablet() && {
      borderRadius: responsive.borderRadius.lg,
      padding: responsive.spacing.xl,
    }),
  },
  darkDropdownButton: {
    borderColor: '#444',
    backgroundColor: '#2a2a2a',
  },
  dropdownButtonText: {
    fontSize: responsive.fontSize.base,
    color: '#333',
    flex: 1,
    ...(isTablet() && { fontSize: responsive.fontSize.lg }),
  },
  placeholderText: {
    color: '#999',
  },
  dropdownList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: responsive.borderRadius.base,
    marginTop: responsive.spacing.xs,
    maxHeight: rp(200),
    zIndex: 1000,
    ...(isTablet() && {
      borderRadius: responsive.borderRadius.lg,
      marginTop: responsive.spacing.sm,
      maxHeight: rp(250),
    }),
  },
  darkDropdownList: {
    backgroundColor: '#2a2a2a',
    borderColor: '#444',
  },
  dropdownScrollView: {
    maxHeight: rp(200),
    ...(isTablet() && { maxHeight: rp(250) }),
  },
  dropdownItem: {
    paddingVertical: responsive.spacing.lg,
    paddingHorizontal: responsive.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    ...(isTablet() && {
      paddingVertical: responsive.spacing.xl,
      paddingHorizontal: responsive.spacing.xl,
    }),
  },
  darkDropdownItem: {
    borderBottomColor: '#444',
  },
  selectedDropdownItem: {
    backgroundColor: '#4CAF50',
  },
  dropdownItemText: {
    fontSize: responsive.fontSize.base,
    color: '#333',
    ...(isTablet() && { fontSize: responsive.fontSize.lg }),
  },
  selectedDropdownItemText: {
    color: '#fff',
    fontWeight: '600',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: responsive.borderRadius.base,
    padding: responsive.spacing.lg,
    fontSize: responsive.fontSize.base,
    color: '#333',
    backgroundColor: '#fff',
    ...(isTablet() && {
      borderRadius: responsive.borderRadius.lg,
      padding: responsive.spacing.xl,
      fontSize: responsive.fontSize.lg,
    }),
  },
  darkTextInput: {
    borderColor: '#444',
    backgroundColor: '#2a2a2a',
    color: '#fff',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: responsive.borderRadius.base,
    padding: responsive.spacing.lg,
    fontSize: responsive.fontSize.base,
    color: '#333',
    backgroundColor: '#fff',
    minHeight: rp(100),
    ...(isTablet() && {
      borderRadius: responsive.borderRadius.lg,
      padding: responsive.spacing.xl,
      fontSize: responsive.fontSize.lg,
      minHeight: rp(120),
    }),
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: responsive.spacing.lg,
    ...(isTablet() && { gap: responsive.spacing.xl }),
  },
  modalButton: {
    flex: 1,
    paddingVertical: responsive.spacing.lg,
    borderRadius: responsive.borderRadius.base,
    alignItems: 'center',
    ...(isTablet() && {
      paddingVertical: responsive.spacing.xl,
      borderRadius: responsive.borderRadius.lg,
    }),
  },
  submitButton: {
    backgroundColor: '#4CAF50',
  },
  cancelButton: {
    backgroundColor: '#F44336',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: responsive.fontSize.base,
    fontWeight: 'bold',
    ...(isTablet() && { fontSize: responsive.fontSize.lg }),
  },
});
