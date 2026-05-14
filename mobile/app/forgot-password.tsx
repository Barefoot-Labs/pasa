import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);

  const onSend = async () => {
    if (!email.trim()) {
      Alert.alert('Enter your email address');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setSent(true);
  };

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView
        style={s.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Back */}
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#94a3b8" />
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>

        {!sent ? (
          <>
            <Text style={s.title}>Forgot password?</Text>
            <Text style={s.sub}>
              Enter your email and we'll send you a reset link.
            </Text>

            <Text style={s.label}>Email address</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />

            <TouchableOpacity
              style={[s.button, (loading || !email.trim()) && s.buttonDisabled]}
              onPress={onSend}
              disabled={loading || !email.trim()}
            >
              {loading
                ? <ActivityIndicator color="#0f172a" />
                : <Text style={s.buttonText}>Send reset link</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <View style={s.successWrap}>
            <View style={s.successIcon}>
              <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
            </View>
            <Text style={s.successTitle}>Check your email</Text>
            <Text style={s.successSub}>
              We sent a reset link to{' '}
              <Text style={s.successEmail}>{email}</Text>.
              {'\n'}Click the link to set a new password.
            </Text>
            <Text style={s.successHint}>
              Didn't receive it? Check your spam folder.
            </Text>
            <TouchableOpacity style={s.button} onPress={() => router.replace('/auth')}>
              <Text style={s.buttonText}>Back to sign in</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0f172a' },
  inner:        { flex: 1, paddingHorizontal: 28, paddingTop: 16 },
  back:         { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 32 },
  backText:     { color: '#94a3b8', fontSize: 14 },
  title:        { fontSize: 26, fontWeight: '800', color: '#f1f5f9', marginBottom: 8 },
  sub:          { fontSize: 14, color: '#94a3b8', marginBottom: 32, lineHeight: 20 },
  label:        { fontSize: 13, fontWeight: '600', color: '#cbd5e1', marginBottom: 6 },
  input:        { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#f1f5f9', marginBottom: 20 },
  button:       { backgroundColor: '#38bdf8', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  buttonDisabled:{ opacity: 0.5 },
  buttonText:   { color: '#0f172a', fontWeight: '700', fontSize: 15 },
  successWrap:  { flex: 1, justifyContent: 'center', gap: 16 },
  successIcon:  { alignItems: 'center', marginBottom: 8 },
  successTitle: { fontSize: 22, fontWeight: '800', color: '#f1f5f9', textAlign: 'center' },
  successSub:   { fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 22 },
  successEmail: { color: '#f1f5f9', fontWeight: '600' },
  successHint:  { fontSize: 12, color: '#475569', textAlign: 'center' },
});
