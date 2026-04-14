import { Link } from 'expo-router';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Home() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>SpeechPal</Text>
          <Text style={styles.subtitle}>Your partner in every word</Text>
        </View>

        <View style={styles.grid}>
          <Link href="/breathing" asChild>
            <TouchableOpacity style={[styles.card, { backgroundColor: '#E0F7FA' }]}>
              <Text style={styles.cardTitle}>Breathing</Text>
              <Text style={styles.cardDesc}>Guided exercises for relaxation</Text>
            </TouchableOpacity>
          </Link>

          <Link href="/metronome" asChild>
            <TouchableOpacity style={[styles.card, { backgroundColor: '#FFF3E0' }]}>
              <Text style={styles.cardTitle}>Metronome</Text>
              <Text style={styles.cardDesc}>Pace your speech rhythm</Text>
            </TouchableOpacity>
          </Link>

          <Link href="/reading" asChild>
            <TouchableOpacity style={[styles.card, { backgroundColor: '#F3E5F5' }]}>
              <Text style={styles.cardTitle}>Reading</Text>
              <Text style={styles.cardDesc}>Practice guided pacing</Text>
            </TouchableOpacity>
          </Link>

          <Link href="/daf" asChild>
            <TouchableOpacity style={[styles.card, { backgroundColor: '#E8EAF6' }]}>
              <Text style={styles.cardTitle}>DAF Loop</Text>
              <Text style={styles.cardDesc}>Delayed Auditory Feedback</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    marginTop: 40,
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  grid: {
    gap: 16,
  },
  card: {
    padding: 24,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 15,
    color: '#4A4A4A',
    lineHeight: 22,
  },
});
