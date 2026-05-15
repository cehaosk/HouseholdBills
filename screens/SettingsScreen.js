import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, TextInput,
  Alert, StatusBar, Platform
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as MediaLibrary from 'expo-media-library';

const DEFAULT_CATEGORIES = [
  'Struja','Voda','Plin','Internet i TV',
  'Unikom','Grad Osijek','Mikic','HRT','Struja - Zajednička'
];

const MONTHS = [
  'Siječanj','Veljača','Ožujak','Travanj','Svibanj','Lipanj',
  'Srpanj','Kolovoz','Rujan','Listopad','Studeni','Prosinac'
];
const BILLS_KEY = 'hh-bills-v1';
const CATS_KEY = 'hh-cats-v1';


export default function SettingsScreen() {
  const [categories, setCategories] = useState([]);
  const [bills, setBills] = useState([]);
  const [newCatName, setNewCatName] = useState('');
  const [catDeleteConfirm, setCatDeleteConfirm] = useState(null);
  const [toast, setToast] = useState(null);
  const [curMonth] = useState(new Date().getMonth());
  const [curYear] = useState(new Date().getFullYear());
  const [newCatHasRazlika, setNewCatHasRazlika] = useState(false);
  

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const b = await SecureStore.getItemAsync(BILLS_KEY);
      if (b) setBills(JSON.parse(b));
      const c = await SecureStore.getItemAsync(CATS_KEY);
      if (c) {
        let cats = JSON.parse(c);
        let changed = false;
        for (const name of DEFAULT_CATEGORIES) {
          const exists = cats.some(cat => cat.name === name);
          if (!exists) {
            cats.push({ id: Date.now() + Math.random(), name, activeFrom: { month: 0, year: 2000 }, deletedFrom: null });
            changed = true;
          }
        }
        setCategories(cats);
        if (changed) await SecureStore.setItemAsync(CATS_KEY, JSON.stringify(cats));
      } else {
        const cats = DEFAULT_CATEGORIES.map((name, i) => ({
          id: Date.now() + i, name,
          activeFrom: { month: 0, year: 2000 },
          deletedFrom: null
        }));
        setCategories(cats);
        await SecureStore.setItemAsync(CATS_KEY, JSON.stringify(cats));
      }
    } catch (e) { console.log(e); }
  }

  async function saveCats(c) {
    setCategories(c);
    await SecureStore.setItemAsync(CATS_KEY, JSON.stringify(c));
  }

  async function saveBillsData(b) {
    setBills(b);
    await SecureStore.setItemAsync(BILLS_KEY, JSON.stringify(b));
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function mi(y, m) { return y * 12 + m; }

  function isCatActive(cat, m, y) {
    if (mi(y, m) < mi(cat.activeFrom.year, cat.activeFrom.month)) return false;
    if (cat.deletedFrom && mi(y, m) >= mi(cat.deletedFrom.year, cat.deletedFrom.month)) return false;
    return true;
  }

 function getActiveNames(m, y) {
    const seen = new Map();
    for (const c of categories) {
      if (isCatActive(c, m, y) && !seen.has(c.name)) {
        seen.set(c.name, { mi: mi(c.activeFrom.year, c.activeFrom.month), order: c.order !== undefined ? c.order : 9999 });
      }
    }
    return [...seen.entries()]
      .sort((a, b) => a[1].order !== b[1].order ? a[1].order - b[1].order : a[1].mi - b[1].mi)
      .map(e => e[0]);
  }

  async function addCategory() {
    if (!newCatName.trim()) return;
    const already = getActiveNames(curMonth, curYear)
      .find(n => n.toLowerCase() === newCatName.trim().toLowerCase());
    if (already) { showToast('Already exists'); return; }
    const addedName = newCatName.trim();
   const newCats = [...categories, {
      id: Date.now(), name: addedName,
      activeFrom: { month: curMonth, year: curYear },
      deletedFrom: null,
      hasRazlika: newCatHasRazlika
    }];
    await saveCats(newCats);
    setNewCatName('');
    setNewCatHasRazlika(false);
    showToast('✓ "' + addedName + '" added');
  }

 async function confirmDeleteCat(name) {
    const newCats = categories.map(c => {
      if (c.name === name && !c.deletedFrom) {
        return { ...c, deletedFrom: { month: curMonth, year: curYear } };
      }
      return c;
    });
    await saveCats(newCats);
    setCatDeleteConfirm(null);
    showToast('"' + name + '" removed from this month onwards');
  }

 async function exportCSV() {
    try {
      if (!bills.length) { showToast('No bills to export yet'); return; }
      const header = 'Name,Month,Year,Amount,DueDate,Notes,Paid';
      const rows = bills.map(b => [
        '"' + (b.name || '') + '"',
        b.month + 1,
        b.year,
        b.amount,
        '"' + (b.dueDate || '') + '"',
        '"' + (b.notes || '') + '"',
        b.paid ? 'Yes' : 'No'
      ].join(','));
      const csv = [header, ...rows].join('\n');
      const today = new Date();
      const filename = 'racuni-' + today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0') + '.csv';
      const path = FileSystem.cacheDirectory + filename;
      await FileSystem.writeAsStringAsync(path, csv);
      await Sharing.shareAsync(path, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
    } catch (e) {
      Alert.alert('Export failed', e.message);
    }
  }

  async function importCSV() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled) return;
      const content = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: 'utf8' });
      const lines = content.split('\n').filter(l => l.trim());
      if (lines.length < 2) { Alert.alert('Invalid file', 'File is empty or has no data.'); return; }
      const header = lines[0].toLowerCase().split(',');
      const idx = {
        name: header.findIndex(h => h.includes('name')),
        month: header.findIndex(h => h.includes('month')),
        year: header.findIndex(h => h.includes('year')),
        amount: header.findIndex(h => h.includes('amount')),
        duedate: header.findIndex(h => h.includes('due')),
        notes: header.findIndex(h => h.includes('notes')),
        paid: header.findIndex(h => h.includes('paid')),
      };
      if (idx.name < 0 || idx.month < 0 || idx.year < 0 || idx.amount < 0) {
        Alert.alert('Invalid file', 'This does not look like a valid export file.');
        return;
      }
      let added = 0, updated = 0, skipped = 0;
      const newBills = [...bills];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
        const name = cols[idx.name];
        const month = parseInt(cols[idx.month]) - 1;
        const year = parseInt(cols[idx.year]);
        const amount = parseFloat(cols[idx.amount]);
        if (!name || isNaN(month) || isNaN(year) || isNaN(amount)) { skipped++; continue; }
        const paid = idx.paid >= 0 ? cols[idx.paid].toLowerCase() === 'yes' : false;
        const dueDate = idx.duedate >= 0 ? cols[idx.duedate] || null : null;
        const notes = idx.notes >= 0 ? cols[idx.notes] || null : null;
        const existingIdx = newBills.findIndex(b => b.name === name && b.month === month && b.year === year);
        if (existingIdx >= 0) {
          newBills[existingIdx] = { ...newBills[existingIdx], amount, paid, dueDate, notes };
          updated++;
        } else {
          newBills.push({ id: Date.now() + i, name, month, year, amount, paid, dueDate, notes, photoUri: null });
          added++;
        }
      }
      await saveBillsData(newBills);
      showToast('✓ ' + added + ' added, ' + updated + ' updated, ' + skipped + ' skipped');
    } catch (e) {
      Alert.alert('Import failed', e.message);
    }
  }

  

  async function restorePhotosFromGallery() {
    try {
      const mediaPerm = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
      if (!mediaPerm.granted) { showToast('Gallery permission needed'); return; }
      const albums = await MediaLibrary.getAlbumsAsync();
      const album = albums.find(a => a.title === 'Računi');
      if (!album) { showToast('No Računi album found in gallery'); return; }
      const { assets } = await MediaLibrary.getAssetsAsync({ album, first: 1000 });
      let matched = 0, skipped = 0;
      const newBills = [...bills];
      for (const asset of assets) {
        const filename = asset.filename;
        const match = filename.match(/^Racuni_(\d{4})_(\d{2})_(.+)\.jpg$/);
        if (!match) { skipped++; continue; }
        const year = parseInt(match[1]);
        const month = parseInt(match[2]) - 1;
        const safeName = match[3];
        const billIdx = newBills.findIndex(b => {
          if (b.month !== month || b.year !== year) return false;
          const bs = b.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
          return bs === safeName;
        });
        if (billIdx < 0) { skipped++; continue; }
        const destPath = FileSystem.documentDirectory + filename;
        await FileSystem.copyAsync({ from: asset.uri, to: destPath });
        newBills[billIdx] = { ...newBills[billIdx], photoUri: destPath };
        matched++;
      }
      await saveBillsData(newBills);
      showToast('✓ ' + matched + ' photos restored, ' + skipped + ' skipped');
    } catch (e) {
      Alert.alert('Restore failed', e.message);
    }
  }

  const activeNames = getActiveNames(curMonth, curYear);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>

        <Text style={s.title}>Settings</Text>

        {/* Categories section */}
        <Text style={s.sectionTitle}>BILL CATEGORIES</Text>
        <Text style={s.sectionNote}>
          Adding a category makes it appear from this month onwards. Removing hides it from this month onwards.
        </Text>


        {activeNames.map(name => (
          <View key={name}>
            <View style={s.catRow}>
              <Text style={s.catName}>{name}</Text>
              <TouchableOpacity
                onPress={() => setCatDeleteConfirm(catDeleteConfirm === name ? null : name)}
                style={s.catRemoveBtn}
              >
                <Text style={s.catRemoveBtnText}>Remove</Text>
              </TouchableOpacity>
            </View>
            {catDeleteConfirm === name && (
              <View style={s.confirmBox}>
                <Text style={s.confirmBoxText}>
                  Hide "{name}" from {MONTHS[curMonth]} {curYear} onwards?
                </Text>
                <View style={s.confirmBoxBtns}>
                  <TouchableOpacity
                    onPress={() => setCatDeleteConfirm(null)}
                    style={s.confirmBoxCancel}
                  >
                    <Text style={{ fontSize: 13, color: '#374151' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => confirmDeleteCat(name)}
                    style={s.confirmBoxConfirm}
                  >
                    <Text style={{ fontSize: 13, color: '#fff', fontWeight: '600' }}>Yes, remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ))}

        <View style={s.addCatRow}>
  <TextInput
    style={s.addCatInput}
    value={newCatName}
    onChangeText={setNewCatName}
    placeholder="New bill name..."
    onSubmitEditing={addCategory}
  />
  <TouchableOpacity style={s.addCatBtn} onPress={addCategory}>
    <Text style={s.addCatBtnText}>+ Add</Text>
  </TouchableOpacity>
</View>
<TouchableOpacity
  style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}
  onPress={() => setNewCatHasRazlika(!newCatHasRazlika)}
>
  <View style={{
    width: 20, height: 20, borderRadius: 4, borderWidth: 2,
    borderColor: newCatHasRazlika ? '#2D3F51' : '#D1D5DB',
    backgroundColor: newCatHasRazlika ? '#2D3F51' : '#fff',
    alignItems: 'center', justifyContent: 'center', marginRight: 8
  }}>
    {newCatHasRazlika && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
  </View>
  <Text style={{ fontSize: 13, color: '#374151' }}>Has Razlika</Text>
</TouchableOpacity>

        {/* Backup section */}
        <Text style={[s.sectionTitle, { marginTop: 28 }]}>BACKUP & RESTORE</Text>

        <TouchableOpacity style={s.backupBtn} onPress={exportCSV}>
          <Text style={s.backupBtnIcon}>⬇️</Text>
          <View>
            <Text style={s.backupBtnTitle}>Export to CSV</Text>
            <Text style={s.backupBtnSub}>Save all bills to a file</Text>
          </View>
        </TouchableOpacity>

       <TouchableOpacity style={s.backupBtn} onPress={importCSV}>
          <Text style={s.backupBtnIcon}>⬆️</Text>
          <View>
            <Text style={s.backupBtnTitle}>Import from CSV</Text>
            <Text style={s.backupBtnSub}>Merge with existing data — nothing is deleted</Text>
          </View>
        </TouchableOpacity>

      <Text style={[s.sectionTitle, { marginTop: 20 }]}>PHOTO RESTORE</Text>
<TouchableOpacity style={s.backupBtn} onPress={restorePhotosFromGallery}>
  <Text style={s.backupBtnIcon}>🖼</Text>
  <View>
    <Text style={s.backupBtnTitle}>Restore photos from gallery</Text>
    <Text style={s.backupBtnSub}>Re-links photos from Računi album to bills</Text>
  </View>
</TouchableOpacity>
<Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8, lineHeight: 18 }}>
  Backup:{'\n'}
  • Photos are automatically saved to the Računi album in your gallery{'\n'}
  • Back up your gallery using Google Photos or any backup app{'\n'}
  {'\n'}
  Restore:{'\n'}
  • Make sure your gallery backup is restored first{'\n'}
  • The Računi album must exist in your gallery{'\n'}
  • Tap the button above to re-link photos to your bills
</Text>

      </ScrollView>

      {toast && (
        <View style={s.toast}>
          <Text style={s.toastText}>{toast}</Text>
        </View>
      )}

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: '600', color: '#111', marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '600', color: '#9CA3AF', letterSpacing: 0.7, marginBottom: 8 },
  sectionNote: { fontSize: 12, color: '#6B7280', marginBottom: 12, padding: 10, backgroundColor: '#F9FAFB', borderRadius: 8, lineHeight: 18 },
  catRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 10, padding: 14, marginBottom: 6 },
  catName: { flex: 1, fontSize: 14, color: '#111' },
  catRemoveBtn: { backgroundColor: '#FEE2E2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  catRemoveBtnText: { color: '#DC2626', fontSize: 13 },
  confirmBox: { backgroundColor: '#FEE2E2', borderRadius: 10, padding: 14, marginBottom: 10 },
  confirmBoxText: { fontSize: 13, color: '#DC2626', marginBottom: 10 },
  confirmBoxBtns: { flexDirection: 'row' },
  confirmBoxCancel: { flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginRight: 8, backgroundColor: '#fff' },
  confirmBoxConfirm: { flex: 1, backgroundColor: '#DC2626', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  addCatRow: { flexDirection: 'row', marginTop: 8 },
  addCatInput: { flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 14, marginRight: 8 },
  addCatBtn: { backgroundColor: '#111', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  addCatBtnText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  backupBtn: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  backupBtnIcon: { fontSize: 24, marginRight: 14 },
  backupBtnTitle: { fontSize: 15, fontWeight: '600', color: '#111' },
  backupBtnSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  toast: { position: 'absolute', top: 60, left: 16, right: 16, backgroundColor: '#16A34A', borderRadius: 10, padding: 14, alignItems: 'center', zIndex: 999 },
  toastText: { color: '#fff', fontSize: 14, fontWeight: '500' },
});