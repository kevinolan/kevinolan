import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withRepeat, 
  withSequence,
  Easing
} from 'react-native-reanimated';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function TrainScreen() {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{ fluency: number; pacing: number } | null>(null);

  const scale = useSharedValue(1);

  async function startRecording() {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
      setResults(null);

      scale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1,
        true
      );
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  }

  async function stopRecording() {
    setIsRecording(false);
    setRecording(null);
    scale.value = withTiming(1);

    if (recording) {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      console.log('Recording stopped and stored at', uri);
      
      // Simulate training the model/analysis
      setIsProcessing(true);
      setTimeout(() => {
        setIsProcessing(false);
        setResults({
          fluency: Math.floor(Math.random() * 30) + 70,
          pacing: Math.floor(Math.random() * 20) + 80,
        });
      }, 2000);
    }
  }

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Speech Training</ThemedText>
        <ThemedText style={styles.subtitle}>Record your speech to analyze patterns</ThemedText>
      </View>

      <View style={styles.content}>
        {!results && !isProcessing && (
          <View style={styles.recordContainer}>
            <Animated.View style={[styles.pulseCircle, animatedStyle, isRecording && styles.recordingActive]} />
            <TouchableOpacity 
              style={[styles.recordButton, isRecording && styles.buttonActive]} 
              onPress={isRecording ? stopRecording : startRecording}
            >
              <IconSymbol 
                name={isRecording ? 'square.fill' : 'waveform'} 
                size={40} 
                color="#FFF" 
              />
            </TouchableOpacity>
            <ThemedText style={styles.instruction}>
              {isRecording ? 'Stop to see analysis' : 'Tap to start recording'}
            </ThemedText>
          </View>
        )}

        {isProcessing && (
          <View style={styles.processingContainer}>
            <IconSymbol name="timer" size={60} color="#4F46E5" />
            <ThemedText type="subtitle" style={styles.processingText}>Processing voice data...</ThemedText>
          </View>
        )}

        {results && (
          <View style={styles.resultsContainer}>
            <ThemedText type="subtitle" style={styles.resultsTitle}>Analysis Complete</ThemedText>
            
            <View style={styles.metricRow}>
              <View style={styles.metric}>
                <ThemedText style={styles.metricLabel}>Fluency</ThemedText>
                <ThemedText type="title" style={styles.metricValue}>{results.fluency}%</ThemedText>
              </View>
              <View style={styles.metric}>
                <ThemedText style={styles.metricLabel}>Pacing</ThemedText>
                <ThemedText type="title" style={styles.metricValue}>{results.pacing}%</ThemedText>
              </View>
            </View>

            <TouchableOpacity style={styles.retryButton} onPress={() => setResults(null)}>
              <ThemedText style={styles.retryText}>Train Again</ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    padding: 24,
    alignItems: 'center',
  },
  subtitle: {
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  recordContainer: {
    alignItems: 'center',
  },
  pulseCircle: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#4F46E5',
    opacity: 0.2,
  },
  recordingActive: {
    backgroundColor: '#EF4444',
    opacity: 0.3,
  },
  recordButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  buttonActive: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  instruction: {
    marginTop: 32,
    color: '#64748B',
    fontWeight: '500',
  },
  processingContainer: {
    alignItems: 'center',
  },
  processingText: {
    marginTop: 16,
    color: '#4F46E5',
  },
  resultsContainer: {
    width: '100%',
    backgroundColor: '#FFF',
    padding: 24,
    borderRadius: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  resultsTitle: {
    marginBottom: 24,
    color: '#1E293B',
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 32,
  },
  metric: {
    alignItems: 'center',
  },
  metricLabel: {
    color: '#64748B',
    marginBottom: 4,
  },
  metricValue: {
    color: '#4F46E5',
  },
  retryButton: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  retryText: {
    color: '#4F46E5',
    fontWeight: '600',
  },
});
