import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

type Role = 'user' | 'assistant';

type Message = {
  id: string;
  role: Role;
  content: string;
};

const INITIAL_MESSAGE: Message = {
  id: 'init',
  role: 'assistant',
  content:
    "Hi! I'm the PASA Assistant. Ask me anything about school admin, marks, or how to use the app.",
};

export default function AssistantScreen() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    // Build the payload — exclude the synthetic initial message id
    const payload = nextMessages.map(({ role, content }) => ({ role, content }));

    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: { messages: payload },
      });

      if (error) throw error;

      const reply: string =
        data?.message ?? data?.content ?? data?.reply ?? 'Sorry, I could not get a response.';

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: reply,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Something went wrong. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  const renderItem = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAssistant]}>
        {!isUser && (
          <View style={styles.avatarWrap}>
            <Ionicons name="sparkles" size={14} color="#38bdf8" />
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
          <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant]}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="sparkles" size={18} color="#38bdf8" />
        </View>
        <View>
          <Text style={styles.headerTitle}>PASA Assistant</Text>
          <Text style={styles.headerSub}>Powered by AI</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Loading indicator */}
        {loading && (
          <View style={styles.loadingRow}>
            <View style={styles.avatarWrap}>
              <Ionicons name="sparkles" size={14} color="#38bdf8" />
            </View>
            <View style={styles.loadingBubble}>
              <ActivityIndicator size="small" color="#38bdf8" />
            </View>
          </View>
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Ask something…"
            placeholderTextColor="#475569"
            multiline
            maxLength={1000}
            returnKeyType="send"
            onSubmitEditing={sendMessage}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!input.trim() || loading}
            activeOpacity={0.7}
          >
            <Ionicons name="send" size={18} color={!input.trim() || loading ? '#334155' : '#0f172a'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex:                   { flex: 1 },
  container:              { flex: 1, backgroundColor: '#0f172a' },

  // Header
  header:                 { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, paddingBottom: 12 },
  headerIcon:             { width: 36, height: 36, borderRadius: 10, backgroundColor: '#0ea5e920', alignItems: 'center', justifyContent: 'center' },
  headerTitle:            { fontSize: 18, fontWeight: '800', color: '#f1f5f9' },
  headerSub:              { fontSize: 11, color: '#64748b', marginTop: 1 },

  // Messages
  messageList:            { padding: 16, paddingBottom: 8, gap: 12 },
  messageRow:             { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  messageRowUser:         { justifyContent: 'flex-end' },
  messageRowAssistant:    { justifyContent: 'flex-start' },
  avatarWrap:             { width: 28, height: 28, borderRadius: 8, backgroundColor: '#0ea5e920', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bubble:                 { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser:             { backgroundColor: '#38bdf8', borderBottomRightRadius: 4 },
  bubbleAssistant:        { backgroundColor: '#1e293b', borderBottomLeftRadius: 4 },
  bubbleText:             { fontSize: 14, lineHeight: 20 },
  bubbleTextUser:         { color: '#0f172a', fontWeight: '500' },
  bubbleTextAssistant:    { color: '#e2e8f0' },

  // Loading
  loadingRow:             { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  loadingBubble:          { backgroundColor: '#1e293b', borderRadius: 16, borderBottomLeftRadius: 4, paddingHorizontal: 18, paddingVertical: 12 },

  // Input bar
  inputBar:               { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, paddingBottom: 8, borderTopWidth: 1, borderTopColor: '#1e293b' },
  textInput:              { flex: 1, backgroundColor: '#1e293b', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, color: '#f1f5f9', fontSize: 14, maxHeight: 120, lineHeight: 20 },
  sendBtn:                { width: 42, height: 42, borderRadius: 12, backgroundColor: '#38bdf8', alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled:        { backgroundColor: '#1e293b' },
});
