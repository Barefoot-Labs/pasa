import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

const CURRENT_YEAR = new Date().getFullYear();
const TERMS = [1, 2, 3, 4];

type Learner = { id: string; first_name: string; last_name: string; grade_id: number };
type Grade   = { id: number; label: string };
type ReportCard = {
  id: string; learner_id: string; academic_year: number; term: number;
  file_name: string; file_path: string; notes: string | null; uploaded_at: string;
  learners: { first_name: string; last_name: string; grade_id: number } | null;
};

export default function ReportCardsUploadScreen() {
  const { primarySchoolId, primaryRole, user } = useAuth();
  const isStaff = ['teacher', 'principal', 'school_admin', 'super_admin'].includes(primaryRole);

  const [learners, setLearners]   = useState<Learner[]>([]);
  const [grades, setGrades]       = useState<Grade[]>([]);
  const [reports, setReports]     = useState<ReportCard[]>([]);
  const [loading, setLoading]     = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Form
  const [learnerId, setLearnerId]   = useState('');
  const [term, setTerm]             = useState(1);
  const [year, setYear]             = useState(CURRENT_YEAR);
  const [pickedFile, setPickedFile] = useState<{ name: string; uri: string; mimeType?: string } | null>(null);

  // Pickers
  const [showLearnerPicker, setShowLearnerPicker] = useState(false);
  const [showTermPicker, setShowTermPicker]       = useState(false);
  const [showYearPicker, setShowYearPicker]       = useState(false);

  const load = async () => {
    if (!primarySchoolId) { setLoading(false); return; }
    setLoading(true);
    const [{ data: l }, { data: g }, { data: r }] = await Promise.all([
      supabase.from('learners').select('id, first_name, last_name, grade_id')
        .eq('school_id', primarySchoolId).order('last_name'),
      supabase.from('grades').select('id, label').order('id'),
      (supabase as any).from('report_cards')
        .select('id, learner_id, academic_year, term, file_name, file_path, notes, uploaded_at, learners(first_name, last_name, grade_id)')
        .eq('school_id', primarySchoolId)
        .order('academic_year', { ascending: false })
        .order('term', { ascending: false })
        .limit(50),
    ]);
    setLearners((l ?? []) as Learner[]);
    setGrades((g ?? []) as Grade[]);
    setReports((r ?? []) as ReportCard[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [primarySchoolId]);

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setPickedFile({ name: asset.name, uri: asset.uri, mimeType: asset.mimeType ?? 'application/pdf' });
  };

  const onUpload = async () => {
    if (!learnerId)   { Alert.alert('Select a learner'); return; }
    if (!pickedFile)  { Alert.alert('Select a PDF file'); return; }
    if (!primarySchoolId) return;

    setUploading(true);
    const path = `${primarySchoolId}/${learnerId}/${year}_T${term}_${Date.now()}.pdf`;

    // Fetch the file as a blob
    const response = await fetch(pickedFile.uri);
    const blob = await response.blob();

    const { error: storageErr } = await supabase.storage
      .from('report-cards')
      .upload(path, blob, { contentType: 'application/pdf', upsert: false });

    if (storageErr) {
      setUploading(false);
      Alert.alert('Upload failed', storageErr.message);
      return;
    }

    const { error: dbErr } = await (supabase as any).from('report_cards').upsert({
      learner_id:    learnerId,
      school_id:     primarySchoolId,
      academic_year: year,
      term,
      file_path:     path,
      file_name:     pickedFile.name,
      uploaded_by:   user?.id,
    }, { onConflict: 'learner_id,academic_year,term' });

    setUploading(false);

    if (dbErr) {
      await supabase.storage.from('report-cards').remove([path]);
      Alert.alert('Error', dbErr.message);
      return;
    }

    Alert.alert('Uploaded', 'Report card uploaded. Parent has been notified.');
    setModalOpen(false);
    setLearnerId(''); setPickedFile(null); setTerm(1); setYear(CURRENT_YEAR);
    load();
  };

  const onDelete = async (card: ReportCard) => {
    Alert.alert(
      'Delete report card',
      `Remove ${card.learners?.first_name}'s Term ${card.term} ${card.academic_year} report card?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            setDeleting(card.id);
            await supabase.storage.from('report-cards').remove([card.file_path]);
            await (supabase as any).from('report_cards').delete().eq('id', card.id);
            setDeleting(null);
            load();
          },
        },
      ],
    );
  };

  const gradeLabel = (id: number) =>
    grades.find(g => g.id === id)?.label ?? (id === 0 ? 'Grade R' : `Grade ${id}`);

  const selectedLearner = learners.find(l => l.id === learnerId);

  if (!isStaff) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.emptyWrap}>
          <Ionicons name="shield-outline" size={40} color="#334155" />
          <Text style={s.empty}>Staff only.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Upload report cards</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setModalOpen(true)}>
          <Ionicons name="add" size={20} color="#0f172a" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#38bdf8" style={{ marginTop: 40 }} />
      ) : reports.length === 0 ? (
        <View style={s.emptyWrap}>
          <Ionicons name="document-text-outline" size={40} color="#334155" />
          <Text style={s.empty}>No report cards uploaded yet.</Text>
          <Text style={s.emptySub}>Tap + to upload a PDF for a learner.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list}>
          {reports.map(card => (
            <View key={card.id} style={s.card}>
              <View style={s.cardIcon}>
                <Ionicons name="document-text" size={22} color="#64748b" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardName}>
                  {card.learners?.first_name} {card.learners?.last_name}
                </Text>
                <Text style={s.cardSub}>
                  {gradeLabel(card.learners?.grade_id ?? 0)} · Term {card.term} · {card.academic_year}
                </Text>
                <Text style={s.cardFile} numberOfLines={1}>{card.file_name}</Text>
              </View>
              <TouchableOpacity
                onPress={() => onDelete(card)}
                disabled={deleting === card.id}
                style={s.deleteBtn}
              >
                {deleting === card.id
                  ? <ActivityIndicator size="small" color="#ef4444" />
                  : <Ionicons name="trash-outline" size={18} color="#ef4444" />}
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Upload modal */}
      <Modal visible={modalOpen} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Upload report card</Text>
            <TouchableOpacity onPress={() => { setModalOpen(false); setLearnerId(''); setPickedFile(null); }}>
              <Ionicons name="close" size={24} color="#94a3b8" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={s.modalBody}>
            {/* Learner */}
            <Text style={s.fieldLabel}>Learner</Text>
            <TouchableOpacity style={s.picker} onPress={() => setShowLearnerPicker(true)}>
              <Text style={learnerId ? s.pickerText : s.pickerPlaceholder}>
                {selectedLearner
                  ? `${selectedLearner.first_name} ${selectedLearner.last_name} · ${gradeLabel(selectedLearner.grade_id)}`
                  : 'Select learner'}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#64748b" />
            </TouchableOpacity>

            {/* Term */}
            <Text style={s.fieldLabel}>Term</Text>
            <TouchableOpacity style={s.picker} onPress={() => setShowTermPicker(true)}>
              <Text style={s.pickerText}>Term {term}</Text>
              <Ionicons name="chevron-down" size={16} color="#64748b" />
            </TouchableOpacity>

            {/* Year */}
            <Text style={s.fieldLabel}>Year</Text>
            <TouchableOpacity style={s.picker} onPress={() => setShowYearPicker(true)}>
              <Text style={s.pickerText}>{year}</Text>
              <Ionicons name="chevron-down" size={16} color="#64748b" />
            </TouchableOpacity>

            {/* File */}
            <Text style={s.fieldLabel}>PDF file</Text>
            <TouchableOpacity style={s.filePicker} onPress={pickFile}>
              <Ionicons name="document-attach-outline" size={20} color="#38bdf8" />
              <Text style={pickedFile ? s.filePickerTextActive : s.filePickerText} numberOfLines={1}>
                {pickedFile ? pickedFile.name : 'Tap to select PDF'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.uploadBtn, (uploading || !learnerId || !pickedFile) && s.uploadBtnDisabled]}
              onPress={onUpload}
              disabled={uploading || !learnerId || !pickedFile}
            >
              {uploading
                ? <ActivityIndicator color="#0f172a" />
                : <Text style={s.uploadBtnText}>Upload</Text>}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>

        {/* Learner picker */}
        <Modal visible={showLearnerPicker} transparent animationType="slide">
          <View style={s.pickerModal}><View style={s.pickerSheet}>
            <Text style={s.pickerTitle}>Select learner</Text>
            <ScrollView>
              {learners.map(l => (
                <TouchableOpacity key={l.id} style={s.pickerOption}
                  onPress={() => { setLearnerId(l.id); setShowLearnerPicker(false); }}>
                  <Text style={[s.pickerOptionText, learnerId === l.id && s.pickerOptionActive]}>
                    {l.first_name} {l.last_name} · {gradeLabel(l.grade_id)}
                  </Text>
                  {learnerId === l.id && <Ionicons name="checkmark" size={16} color="#38bdf8" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={s.pickerCancel} onPress={() => setShowLearnerPicker(false)}>
              <Text style={s.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View></View>
        </Modal>

        {/* Term picker */}
        <Modal visible={showTermPicker} transparent animationType="slide">
          <View style={s.pickerModal}><View style={s.pickerSheet}>
            <Text style={s.pickerTitle}>Select term</Text>
            {TERMS.map(t => (
              <TouchableOpacity key={t} style={s.pickerOption}
                onPress={() => { setTerm(t); setShowTermPicker(false); }}>
                <Text style={[s.pickerOptionText, term === t && s.pickerOptionActive]}>Term {t}</Text>
                {term === t && <Ionicons name="checkmark" size={16} color="#38bdf8" />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.pickerCancel} onPress={() => setShowTermPicker(false)}>
              <Text style={s.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View></View>
        </Modal>

        {/* Year picker */}
        <Modal visible={showYearPicker} transparent animationType="slide">
          <View style={s.pickerModal}><View style={s.pickerSheet}>
            <Text style={s.pickerTitle}>Select year</Text>
            {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(y => (
              <TouchableOpacity key={y} style={s.pickerOption}
                onPress={() => { setYear(y); setShowYearPicker(false); }}>
                <Text style={[s.pickerOptionText, year === y && s.pickerOptionActive]}>{y}</Text>
                {year === y && <Ionicons name="checkmark" size={16} color="#38bdf8" />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.pickerCancel} onPress={() => setShowYearPicker(false)}>
              <Text style={s.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View></View>
        </Modal>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#0f172a' },
  header:             { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 12 },
  title:              { fontSize: 22, fontWeight: '800', color: '#f1f5f9' },
  addBtn:             { backgroundColor: '#38bdf8', borderRadius: 20, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  list:               { padding: 16, gap: 10, paddingBottom: 40 },
  emptyWrap:          { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  empty:              { color: '#94a3b8', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  emptySub:           { color: '#475569', fontSize: 13, textAlign: 'center' },
  card:               { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1e293b', borderRadius: 12, padding: 14 },
  cardIcon:           { width: 40, height: 40, borderRadius: 10, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
  cardName:           { color: '#f1f5f9', fontWeight: '600', fontSize: 14 },
  cardSub:            { color: '#64748b', fontSize: 12, marginTop: 2 },
  cardFile:           { color: '#475569', fontSize: 11, marginTop: 2 },
  deleteBtn:          { padding: 4 },
  modal:              { flex: 1, backgroundColor: '#0f172a' },
  modalHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  modalTitle:         { fontSize: 18, fontWeight: '700', color: '#f1f5f9' },
  modalBody:          { padding: 20, gap: 4, paddingBottom: 40 },
  fieldLabel:         { fontSize: 13, fontWeight: '600', color: '#94a3b8', marginTop: 14, marginBottom: 6 },
  picker:             { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13 },
  pickerText:         { color: '#f1f5f9', fontSize: 14 },
  pickerPlaceholder:  { color: '#475569', fontSize: 14 },
  filePicker:         { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#38bdf840', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13 },
  filePickerText:     { color: '#475569', fontSize: 14, flex: 1 },
  filePickerTextActive:{ color: '#38bdf8', fontSize: 14, flex: 1 },
  uploadBtn:          { backgroundColor: '#38bdf8', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  uploadBtnDisabled:  { opacity: 0.5 },
  uploadBtnText:      { color: '#0f172a', fontWeight: '700', fontSize: 15 },
  pickerModal:        { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000080' },
  pickerSheet:        { backgroundColor: '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', paddingBottom: 20 },
  pickerTitle:        { fontSize: 16, fontWeight: '700', color: '#f1f5f9', padding: 20, borderBottomWidth: 1, borderBottomColor: '#334155' },
  pickerOption:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#0f172a' },
  pickerOptionText:   { color: '#cbd5e1', fontSize: 15 },
  pickerOptionActive: { color: '#38bdf8', fontWeight: '700' },
  pickerCancel:       { margin: 16, backgroundColor: '#0f172a', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  pickerCancelText:   { color: '#94a3b8', fontWeight: '600', fontSize: 15 },
});
