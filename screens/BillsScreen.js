import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Modal, TextInput,
  Alert, Image, StatusBar, Platform
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as MediaLibrary from 'expo-media-library';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Svg, { Polyline } from 'react-native-svg';




const DEFAULT_CATEGORIES = [
  'Struja','Voda','Plin','Internet i TV',
  'Unikom','Grad Osijek','Mikic','HRT','Struja - Zajednička'
];

const RAZLIKA_DEFAULTS = ['Struja', 'Unikom', 'Plin', 'Struja - Zajednička'];


const MONTHS = [
  'Siječanj','Veljača','Ožujak','Travanj','Svibanj','Lipanj',
  'Srpanj','Kolovoz','Rujan','Listopad','Studeni','Prosinac'
];
const BILLS_KEY = 'hh-bills-v1';
const CATS_KEY = 'hh-cats-v1';

export default function BillsScreen({ initialMonth, initialYear }) {
  const [categories, setCategories] = useState(
  DEFAULT_CATEGORIES.map((name, i) => ({
    id: i, name,
    activeFrom: { month: 0, year: 2000 },
    deletedFrom: null,
    hasRazlika: RAZLIKA_DEFAULTS.includes(name)
  }))
);
  const [bills, setBills] = useState([]);
  const [curMonth, setCurMonth] = useState(initialMonth !== null && initialMonth !== undefined ? initialMonth : new Date().getMonth());
  const [curYear, setCurYear] = useState(initialYear !== null && initialYear !== undefined ? initialYear : new Date().getFullYear());
  const [modalVisible, setModalVisible] = useState(false);
  const [manageVisible, setManageVisible] = useState(false);
  const [editSlot, setEditSlot] = useState(null);
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState(null);
  const [lightboxUri, setLightboxUri] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [newCatName, setNewCatName] = useState('');
  const [catDeleteConfirm, setCatDeleteConfirm] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [toast, setToast] = useState(null);
  const [backupVisible, setBackupVisible] = useState(false);
  const [expandedBill, setExpandedBill] = useState(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scanned = React.useRef(false);
  const [monthSwitchPrompt, setMonthSwitchPrompt] = useState(null);
 const [razlikaModalVisible, setRazlikaModalVisible] = useState(false);
const [razlikaSlot, setRazlikaSlot] = useState(null);
const [razlikaAmount, setRazlikaAmount] = useState('');
const [razlikaDueDate, setRazlikaDueDate] = useState('');
const [razlikaNotes, setRazlikaNotes] = useState('');
const [razlikaPhotoUri, setRazlikaPhotoUri] = useState(null);
const [showRazlikaDatePicker, setShowRazlikaDatePicker] = useState(false);
const [razlikaDeleteConfirm, setRazlikaDeleteConfirm] = useState(null);
const [newCatHasRazlika, setNewCatHasRazlika] = useState(false);
const [reorderMode, setReorderMode] = useState(false);


 

  useEffect(() => { loadAll(); }, []);

   function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }


const QR_MAPPINGS = [
    { keywords: ['unikom'], category: 'Unikom' },
    { keywords: ['a1 hrvatska', 'a1 telecom'], category: 'Internet i TV' },
    { keywords: ['hrvatska radiotelevizija'], category: 'HRT' },
    { keywords: ['hep-plin', 'hep plin'], category: 'Plin' },
    { keywords: ['hep elektra', 'hep'], category: 'Struja' },
    { keywords: ['mikić', 'mikic'], category: 'Mikic' },
    { keywords: ['grad osijek'], category: 'Grad Osijek' },
    { keywords: ['vodovod'], category: 'Voda' },
  ];


 function parseHUB3(raw) {
    try {
      const lines = raw.split(/\r?\n/).map(l => l.trim());
      if (!lines[0].startsWith('HRVHUB3')) return null;
      const amountRaw = lines[2];
      const amount = (parseInt(amountRaw, 10) / 100).toFixed(2);
      const recipientName = lines[6] ? lines[6].toLowerCase().trim() : '';
      let category = null;
      for (const mapping of QR_MAPPINGS) {
        if (mapping.keywords.some(k => recipientName.includes(k))) {
          category = mapping.category;
          break;
        }
      }
      // Try to extract month and year from description line
      let billMonth = null;
      let billYear = null;
      const allText = lines.join(' ');
      // Match patterns like 06/2026 or 0626
     // Only match MM/YYYY format in description - most reliable
      const matchSlash = allText.match(/(\d{1,2})[\/.](\d{4})/);
      if (matchSlash) {
        const m = parseInt(matchSlash[1]);
        const y = parseInt(matchSlash[2]);
        if (m >= 1 && m <= 12 && y >= 2020 && y <= 2035) {
          billMonth = m - 1;
          billYear = y;
        }
      }

      if (billMonth === null) {
              const matchReverse = allText.match(/(\d{4})\/(\d{2})/);
              if (matchReverse) {
                const y = parseInt(matchReverse[1]);
                const m = parseInt(matchReverse[2]);
                if (m >= 1 && m <= 12 && y >= 2020 && y <= 2035) {
                  billMonth = m - 1;
                  billYear = y;
                }
              }
            }

      if (billMonth === null) {
        const croatianMonths = [
          'sije[cč]anj','velja[cč]a','o[žz]ujak','travanj','svibanj','lipanj',
          'srpanj','kolovoz','rujan','listopad','studeni','prosinac'
        ];
        const lowerText = allText.toLowerCase();
        for (let i = 0; i < croatianMonths.length; i++) {
          const matchCro = lowerText.match(new RegExp(croatianMonths[i] + '[^\\d]*(\\d{4})'));
          if (matchCro) {
            const y = parseInt(matchCro[1]);
            if (y >= 2020 && y <= 2035) {
              billMonth = i;
              billYear = y;
              break;
            }
          }
        }
      }
      // Distinguish Struja vs Struja Zajednička by payer name
      if (category === 'Struja') {
        const payerName = lines[3] ? lines[3].toLowerCase() : '';
        if (payerName.includes('zajednička') || payerName.includes('zajedni')) {
          category = 'Struja - Zajednička';
        }
      }

      return { amount, category, billMonth, billYear };
    } catch (e) {
      return null;
    }
  }

  function fixCroatianChars(str) {
    return str
      .replace(/\u00BE/g, 'ž')
      .replace(/\u00B9/g, 'š')
      .replace(/\u00E6/g, 'č')
      .replace(/\u00E8/g, 'č')
      .replace(/\u00F0/g, 'đ')
      .replace(/\u00E0/g, 'ć')
      .replace(/\u00DD/g, 'Ž')
      .replace(/\u00A9/g, 'Š')
      .replace(/\u00C6/g, 'Č')
      .replace(/\u00D0/g, 'Đ')
      .replace(/\u00C0/g, 'Ć')
      .replace(/¾/g, 'ž')
      .replace(/¹/g, 'š')
      .replace(/æ/g, 'č')
      .replace(/ð/g, 'đ')
      .replace(/à/g, 'ć');
  }

function handleQRScan({ data }) {
    if (scanned.current) return;
    scanned.current = true;
    setScannerVisible(false);
    const parsed = parseHUB3(data);
    if (!parsed) {
      Alert.alert('Not recognised', 'This QR code is not a supported bill format.');
      scanned.current = false;
      return;
    }
    if (!parsed.category) {
      Alert.alert('Unknown bill', 'Could not match this bill to a known category.');
      scanned.current = false;
      return;
    }

    const openForm = (month, year) => {
      if (month !== undefined) { setCurMonth(month); setCurYear(year); }
      setEditSlot(parsed.category);
      setAmount(parsed.amount);
      setDueDate('');
      setNotes('');
      setPhotoUri(null);
      setModalVisible(true);
      scanned.current = false;
    };

    if (parsed.billMonth !== null && parsed.billYear !== null) {
      const billMonthMatch = parsed.billMonth === curMonth && parsed.billYear === curYear;
      if (!billMonthMatch) {
        const billMonthName = MONTHS[parsed.billMonth] + ' ' + parsed.billYear;
        const curMonthName = MONTHS[curMonth] + ' ' + curYear;
        setMonthSwitchPrompt({
          billMonthName,
          curMonthName,
          onStay: () => { setMonthSwitchPrompt(null); openForm(); },
          onSwitch: () => { setMonthSwitchPrompt(null); openForm(parsed.billMonth, parsed.billYear); }
        });
        return;
      }
    }
    openForm();
  }


 async function openScanner() {
    scanned.current = false;
    if (!cameraPermission?.granted) {
      const perm = await requestCameraPermission();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Camera permission is required to scan QR codes.');
        return;
      }
    }
    setScannerVisible(true);
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
      const path = FileSystem.documentDirectory + filename;
      await FileSystem.writeAsStringAsync(path, csv, { encoding: 'utf8' });
      await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Export Bills CSV' });
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
      await saveBills(newBills);
      showToast('✓ Imported: ' + added + ' added, ' + updated + ' updated, ' + skipped + ' skipped');
    } catch (e) {
      Alert.alert('Import failed', e.message);
    }
  }

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
            cats.push({ id: Date.now() + Math.random(), name, activeFrom: { month: 0, year: 2000 }, deletedFrom: null, hasRazlika: RAZLIKA_DEFAULTS.includes(name) });
            changed = true;
          }
        }
        cats = cats.map(c => ({ ...c, hasRazlika: c.hasRazlika !== undefined ? c.hasRazlika : RAZLIKA_DEFAULTS.includes(c.name) }));
          setCategories(cats);
          if (changed) await SecureStore.setItemAsync(CATS_KEY, JSON.stringify(cats));
      } else {
        const cats = DEFAULT_CATEGORIES.map((name, i) => ({
          id: Date.now() + i, name,
          activeFrom: { month: 0, year: 2000 },
          deletedFrom: null,
          hasRazlika: RAZLIKA_DEFAULTS.includes(name)
        }));
        setCategories(cats);
        await SecureStore.setItemAsync(CATS_KEY, JSON.stringify(cats));
      }
    } catch (e) { console.log(e); }
  }

async function saveBills(b) {
    setBills(b);
    await SecureStore.setItemAsync(BILLS_KEY, JSON.stringify(b));
  }

  async function saveCats(c) {
    setCategories(c);
    await SecureStore.setItemAsync(CATS_KEY, JSON.stringify(c));
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

  function getBill(name, m, y) {
    return bills.find(b => b.name === name && b.month === m && b.year === y) || null;
  }

  function fmt(n) { return '€' + parseFloat(n || 0).toFixed(2); }

  function changeMonth(d) {
    let m = curMonth + d;
    let y = curYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setCurMonth(m);
    setCurYear(y);
    setDeleteConfirm(null);
  }

 function openForm(name) {
  const b = getBill(name, curMonth, curYear);
  setEditSlot(name);
  setAmount(b ? String(b.amount) : '');
  setDueDate(b && b.dueDate ? b.dueDate : '');
  setNotes(b && b.notes ? b.notes : '');
  setPhotoUri(b && b.photoUri ? b.photoUri : null);
  setModalVisible(true);
}



 

  

  async function submitForm() {
    if (!amount) { Alert.alert('Please enter an amount.'); return; }
    const existing = getBill(editSlot, curMonth, curYear);
    const bill = {
      name: editSlot,
      amount: parseFloat(amount),
      dueDate: dueDate || null,
      notes: notes || null,
      month: curMonth,
      year: curYear,
      photoUri: photoUri || null,
      paid: existing ? existing.paid : false,
      id: existing ? existing.id : Date.now(),
    };
    const newBills = existing
      ? bills.map(b => b.id === existing.id ? bill : b)
      : [...bills, bill];
    await SecureStore.setItemAsync(BILLS_KEY, JSON.stringify(newBills));
    setBills(newBills);
    setAmount('');
    setDueDate('');
    setNotes('');
    setPhotoUri(null);
    setEditSlot(null);
    setModalVisible(false);
    setExpandedBill(null);
    showToast('✓ Bill saved successfully');
  }

  async function togglePaid(name) {
    const b = getBill(name, curMonth, curYear);
    if (!b) return;
    await saveBills(bills.map(x => x.id === b.id ? { ...x, paid: !x.paid } : x));
  }

function openRazlikaForm(baseName) {
    const razlikaName = baseName + ' - Razlika';
    const b = getBill(razlikaName, curMonth, curYear);
    setRazlikaSlot(baseName);
    setRazlikaAmount(b ? String(b.amount) : '');
    setRazlikaDueDate(b && b.dueDate ? b.dueDate : '');
    setRazlikaNotes(b && b.notes ? b.notes : '');
    setRazlikaPhotoUri(b && b.photoUri ? b.photoUri : null);
    setRazlikaModalVisible(true);
  }

  async function submitRazlika() {
    if (!razlikaAmount) { Alert.alert('Please enter an amount.'); return; }
    const razlikaName = razlikaSlot + ' - Razlika';
    const existing = getBill(razlikaName, curMonth, curYear);
    const bill = {
      name: razlikaName,
      amount: parseFloat(razlikaAmount),
      dueDate: razlikaDueDate || null,
      notes: razlikaNotes || null,
      month: curMonth,
      year: curYear,
      photoUri: razlikaPhotoUri || null,
      paid: existing ? existing.paid : false,
      id: existing ? existing.id : Date.now(),
    };
    const newBills = existing
      ? bills.map(b => b.id === existing.id ? bill : b)
      : [...bills, bill];
    await SecureStore.setItemAsync(BILLS_KEY, JSON.stringify(newBills));
    setBills(newBills);
    setRazlikaModalVisible(false);
    setRazlikaAmount('');
    setRazlikaDueDate('');
    setRazlikaNotes('');
    setRazlikaPhotoUri(null);
    setRazlikaSlot(null);
    showToast('✓ Razlika saved');
  }

async function savePhotoToRacuni(sourceUri, name) {
    try {
      const mediaPerm = await MediaLibrary.requestPermissionsAsync();
      const monthStr = String(curMonth + 1).padStart(2, '0');
      const safeName = (name || 'Bill').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      const filename = `Racuni_${curYear}_${monthStr}_${safeName}.jpg`;
      const destPath = FileSystem.documentDirectory + filename;
      await FileSystem.copyAsync({ from: sourceUri, to: destPath });
      if (mediaPerm.granted) {
        const asset = await MediaLibrary.createAssetAsync(destPath);
        await MediaLibrary.createAlbumAsync('Računi', asset, false);
      }
      return destPath;
    } catch (e) {
      console.log('Photo save error:', e.message);
      return sourceUri;
    }
  }

  async function takePhoto() {
    try {
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (!result.canceled) {
        const saved = await savePhotoToRacuni(result.assets[0].uri, editSlot);
        setPhotoUri(saved);
      }
    } catch(e) {
      Alert.alert('Camera error', e.message);
    }
  }

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Gallery permission is required.'); return; }
   const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) {
      const saved = await savePhotoToRacuni(result.assets[0].uri, editSlot);
      setPhotoUri(saved);
    }
  }

  async function takeRazlikaPhoto() {
    try {
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (!result.canceled) {
        const saved = await savePhotoToRacuni(result.assets[0].uri, razlikaSlot + '_Razlika');
        setRazlikaPhotoUri(saved);
      }
    } catch(e) {
      Alert.alert('Camera error', e.message);
    }
  }

  async function pickRazlikaPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Gallery permission is required.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) {
      const saved = await savePhotoToRacuni(result.assets[0].uri, razlikaSlot + '_Razlika');
      setRazlikaPhotoUri(saved);
    }
  }



  async function confirmDeleteRazlika(baseName) {
    const razlikaName = baseName + ' - Razlika';
    const b = getBill(razlikaName, curMonth, curYear);
    if (!b) return;
    const newBills = bills.filter(x => x.id !== b.id);
    await SecureStore.setItemAsync(BILLS_KEY, JSON.stringify(newBills));
    setBills(newBills);
    setRazlikaDeleteConfirm(null);
    showToast('Razlika removed');
  }


  async function confirmDelete(name) {
    const b = getBill(name, curMonth, curYear);
    if (!b) return;
    await saveBills(bills.filter(x => x.id !== b.id));
    setDeleteConfirm(null);
  }

  

  

  async function addCategory() {
    if (!newCatName.trim()) return;
    const already = getActiveNames(curMonth, curYear)
      .find(n => n.toLowerCase() === newCatName.trim().toLowerCase());
    if (already) { Alert.alert('Already exists'); return; }
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
    Alert.alert(
      'Category added!',
      '"' + addedName + '" has been added.',
      [
        { text: 'Add another', style: 'default' },
        { text: 'Done', style: 'default', onPress: () => setManageVisible(false) },
      ]
    );
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
    setManageVisible(false);
    Alert.alert(
      'Category removed',
      '"' + name + '" will no longer appear from ' + MONTHS[curMonth] + ' ' + curYear + ' onwards.',
      [{ text: 'OK' }]
    );
  }

  function dueBadgeText(dateStr, isPaid) {
    if (!dateStr) return null;
    try {
      const due = new Date(dateStr + 'T00:00:00');
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const diff = Math.round((due - today) / (1000 * 60 * 60 * 24));
      const label = due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      if (!isPaid && diff < 0) return { text: '⚠ Overdue ' + label, color: '#fff', bg: '#F59E0B' };
      if (!isPaid && diff <= 5) return { text: '⏰ Due ' + label, color: '#D97706', bg: null };
      return { text: 'Due ' + label, color: '#6B7280', bg: null };
    } catch (e) { return null; }
  }

 const razlikaCategories = categories
    .filter(c => c.hasRazlika && !c.deletedFrom)
    .map(c => c.name);
  const activeNames = getActiveNames(curMonth, curYear);
  const entered = activeNames.map(n => getBill(n, curMonth, curYear)).filter(Boolean);
  const razlikaBills = razlikaCategories
    .map(n => getBill(n + ' - Razlika', curMonth, curYear))
    .filter(Boolean);
  const allEnteredBills = [...entered, ...razlikaBills];
  const total = allEnteredBills.reduce((s, b) => s + (b.amount || 0), 0);
  const paid = allEnteredBills.filter(b => b.paid).reduce((s, b) => s + (b.amount || 0), 0);
  const pct = activeNames.length ? Math.round((entered.length / activeNames.length) * 100) : 0;

async function moveCategory(name, direction) {
    const names = getActiveNames(curMonth, curYear);
    const currentIndex = names.indexOf(name);
    const newIndex = currentIndex + direction;
    if (newIndex < 0 || newIndex >= names.length) return;
    const newCats = [...categories];
    names.forEach((n, i) => {
      const cat = newCats.find(c => c.name === n && !c.deletedFrom);
      if (cat) cat.order = i;
    });
    const catA = newCats.find(c => c.name === names[currentIndex] && !c.deletedFrom);
    const catB = newCats.find(c => c.name === names[newIndex] && !c.deletedFrom);
    if (catA && catB) {
      const temp = catA.order;
      catA.order = catB.order;
      catB.order = temp;
    }
    await saveCats(newCats);
  }

  return (
    <SafeAreaView style={s.safe}>

     {/* Header */}
      <View style={s.header}>
        <View>
          <Image source={require('../assets/logo.png')} style={{ height: 26, width: 120 }} resizeMode="contain" />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity
          style={[s.scanBtn, { marginRight: 8, backgroundColor: reorderMode ? '#F59E0B' : '#D1D5DB' }]}
          onPress={() => setReorderMode(!reorderMode)}
        >
          <Text style={s.scanBtnText}>⇅</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.scanBtn} onPress={openScanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 18, height: 18, marginRight: 6 }}>
              <View style={{ position: 'absolute', top: 0, left: 0, width: 6, height: 6, borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#fff' }} />
              <View style={{ position: 'absolute', top: 0, right: 0, width: 6, height: 6, borderTopWidth: 1, borderRightWidth: 1, borderColor: '#fff' }} />
              <View style={{ position: 'absolute', bottom: 0, left: 0, width: 6, height: 6, borderBottomWidth: 1, borderLeftWidth: 1, borderColor: '#fff' }} />
              <View style={{ position: 'absolute', bottom: 0, right: 0, width: 6, height: 6, borderBottomWidth: 1, borderRightWidth: 1, borderColor: '#fff' }} />
              <View style={{ position: 'absolute', top: 7, left: 7, width: 4, height: 4, backgroundColor: '#fff' }} />
            </View>
            <Text style={s.scanBtnText}>Scan QR</Text>
          </View>
        </TouchableOpacity>
        </View>
      </View>

      {/* Month nav */}
      <View style={s.monthNav}>
        <TouchableOpacity style={s.navBtn} onPress={() => changeMonth(-1)}>
          <Text style={s.navBtnText}>‹</Text>
        </TouchableOpacity>
       <TouchableOpacity onPress={() => setShowMonthPicker(true)} style={{ alignItems: 'center' }}>
  <Text style={s.monthLabel}>{MONTHS[curMonth]} {curYear}</Text>
  <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
    {String(curMonth + 1).padStart(2, '0')}/{curYear}
  </Text>
</TouchableOpacity>
        <TouchableOpacity style={s.navBtn} onPress={() => changeMonth(1)}>
          <Text style={s.navBtnText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={s.statLabel}>TOTAL</Text>
          <Text style={s.statVal}>{fmt(total)}</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statLabel}>PAID</Text>
          <Text style={[s.statVal, { color: '#2D3F51' }]}>{fmt(paid)}</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statLabel}>UNPAID</Text>
          <Text style={[s.statVal, { color: (total - paid) > 0 ? '#DC2626' : '#9CA3AF' }]}>{fmt(total - paid)}</Text>
        </View>
      </View>

      {/* Progress */}
      <View style={s.progressWrap}>
        <Text style={s.progressLabel}>
          {entered.length} of {activeNames.length} bills entered · {pct}% complete
        </Text>
        <View style={s.progressTrack}>
         <View style={[s.progressFill, { width: pct + '%' }]} />
        </View>
      </View>

      {/* Bills list */}
     <ScrollView style={s.list} contentContainerStyle={{ paddingBottom: 20, paddingTop: 8 }}>
        {activeNames.map(name => {
          const bill = getBill(name, curMonth, curYear);
          const isConfirming = deleteConfirm === name;
          
          if (bill) {
            const due = dueBadgeText(bill.dueDate, bill.paid);
            const isExpanded = expandedBill === name;
            const isOverdue = due && due.bg === '#F59E0B';
            const overdueDays = bill.dueDate && !bill.paid ? (() => {
              const d = new Date(bill.dueDate + 'T00:00:00');
              const today = new Date(); today.setHours(0,0,0,0);
              const diff = Math.round((today - d) / (1000*60*60*24));
              return diff > 0 ? diff : null;
            })() : null;

            const razlikaName = name + ' - Razlika';
            const razlikaBill = razlikaCategories.includes(name) ? getBill(razlikaName, curMonth, curYear) : null;
            const razlikaDue = razlikaBill ? dueBadgeText(razlikaBill.dueDate, razlikaBill.paid) : null;
            const razlikaOverdueDays = razlikaBill && razlikaBill.dueDate && !razlikaBill.paid ? (() => {
              const d = new Date(razlikaBill.dueDate + 'T00:00:00');
              const today = new Date(); today.setHours(0,0,0,0);
              const diff = Math.round((today - d) / (1000*60*60*24));
              return diff > 0 ? diff : null;
            })() : null;

            return (
              <View key={name} style={s.card}>

                {/* ── Main bill collapsed row ── */}
                <View style={s.cardMain}>
                  <TouchableOpacity
                    style={[s.checkBtn, bill.paid && s.checkBtnChecked]}
                    onPress={() => togglePaid(name)}
                  >
                    {bill.paid && (
                      <Svg width="16" height="16" viewBox="0 0 24 24">
                        <Polyline points="4,12 9,17 20,6" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </Svg>
                    )}
                  </TouchableOpacity>
                  {bill.photoUri
                    ? <TouchableOpacity onPress={() => setLightboxUri(bill.photoUri)}>
                        <Image source={{ uri: bill.photoUri }} style={s.thumb} />
                      </TouchableOpacity>
                    : <View style={s.thumbPh}>
                        <Text style={{ fontSize: 16 }}>📷</Text>
                      </View>
                  }
                  <View style={s.cardInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[s.cardName, bill.paid && { textDecorationLine: 'line-through', color: '#9CA3AF' }]}>{name}</Text>
                      {isOverdue && !bill.paid && (
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#F59E0B', marginLeft: 6 }} />
                      )}
                     
                    </View>
                    <View style={s.cardMeta}>
                      <View style={[s.statusBadge, bill.paid ? s.badgePaid : s.badgeUnpaid]}>
                        <Text style={{ fontSize: 10, fontWeight: '500', color: bill.paid ? '#16A34A' : '#DC2626' }}>
                          {bill.paid ? 'Paid' : 'Unpaid'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Text style={s.cardAmount}>{fmt(bill.amount)}</Text>
                  <TouchableOpacity
                    style={s.expandBtn}
                    onPress={() => setExpandedBill(isExpanded ? null : name)}
                  >
                    <Text style={s.expandBtnText}>{isExpanded ? '▲' : '▼'}</Text>
                  </TouchableOpacity>
                 {reorderMode && (
                    <View style={{ flexDirection: 'row' }}>
                     <TouchableOpacity onPress={() => moveCategory(name, -1)} style={[s.orderBtn, { backgroundColor: '#D1D5DB' }]}>
                      <Text style={s.orderBtnText}>▲</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => moveCategory(name, 1)} style={[s.orderBtn, { marginLeft: 4, backgroundColor: '#D1D5DB' }]}>
                      <Text style={s.orderBtnText}>▼</Text>
                    </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* ── Razlika collapsed row (when exists and not expanded) ── */}
                {razlikaBill && !isExpanded && (
                  <View style={s.cardMain}>
                    <TouchableOpacity
                      style={[s.checkBtn, razlikaBill.paid && s.checkBtnChecked]}
                      onPress={() => togglePaid(razlikaName)}
                    >
                      {razlikaBill.paid && (
                                  <Svg width="16" height="16" viewBox="0 0 24 24">
                                    <Polyline points="4,12 9,17 20,6" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </Svg>
                                )}
                    </TouchableOpacity>
                    {razlikaBill.photoUri
                      ? <TouchableOpacity onPress={() => setLightboxUri(razlikaBill.photoUri)}>
                          <Image source={{ uri: razlikaBill.photoUri }} style={s.thumb} />
                        </TouchableOpacity>
                      : <View style={s.thumbPh}>
                          <Text style={{ fontSize: 16 }}>📷</Text>
                        </View>
                    }
                    <View style={s.cardInfo}>
                      <Text style={[s.cardName, razlikaBill.paid && { textDecorationLine: 'line-through', color: '#9CA3AF' }]}>
                        {name} - Razlika
                      </Text>
                      <View style={s.cardMeta}>
                        <View style={[s.statusBadge, razlikaBill.paid ? s.badgePaid : s.badgeUnpaid]}>
                          <Text style={{ fontSize: 10, fontWeight: '500', color: razlikaBill.paid ? '#16A34A' : '#DC2626' }}>
                            {razlikaBill.paid ? 'Paid' : 'Unpaid'}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Text style={s.cardAmount}>{fmt(razlikaBill.amount)}</Text>
                    <View style={{ width: 36 }} />
                  </View>
                )}

                {/* ── Expanded section ── */}
                {isExpanded && (
                  <View style={s.expandedSection}>

                    {/* Main bill details */}
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 8 }}>MAIN BILL</Text>
                    {overdueDays && (
                      <View style={s.overdueRow}>
                        <Text style={s.overdueText}>⚠ Overdue by {overdueDays} {overdueDays === 1 ? 'day' : 'days'}</Text>
                      </View>
                    )}
                    {bill.dueDate && !overdueDays && due && (
                      <View style={s.dueDateRow}>
                        <Text style={s.dueDateText}>{due.text}</Text>
                      </View>
                    )}
                    {bill.notes && (
                      <View style={s.notesRow}>
                        <Text style={s.notesLabel}>Notes: </Text>
                        <Text style={s.notesValue}>{bill.notes}</Text>
                      </View>
                    )}
                    <View style={s.expandedActions}>
                      <TouchableOpacity style={s.expandedEditBtn} onPress={() => { setExpandedBill(null); openForm(name); }}>
                        <Text style={s.expandedEditBtnText}>✎ Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.expandedDeleteBtn} onPress={() => setDeleteConfirm(name)}>
                        <Text style={s.expandedDeleteBtnText}>✕ Remove</Text>
                      </TouchableOpacity>
                    </View>
                    {isConfirming && (
                      <View style={s.confirmRow}>
                        <Text style={s.confirmMsg}>Remove "{name}" this month?</Text>
                        <View style={s.confirmBtns}>
                          <TouchableOpacity style={s.confirmNo} onPress={() => setDeleteConfirm(null)}>
                            <Text style={{ fontSize: 12, color: '#374151' }}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={s.confirmYes} onPress={() => confirmDelete(name)}>
                            <Text style={{ fontSize: 12, color: '#fff' }}>Remove</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    {/* Razlika section */}
                    {razlikaCategories.includes(name) && (
                      <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: '#9CA3AF', letterSpacing: 0.5 }}>RAZLIKA (CORRECTION)</Text>
                          {!razlikaBill && (
                            <TouchableOpacity onPress={() => openRazlikaForm(name)}>
                              <Text style={{ fontSize: 13, color: '#2D3F51', fontWeight: '600' }}>+ Add</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        {razlikaBill ? (
                          <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                              <TouchableOpacity
                                style={[s.checkBtn, razlikaBill.paid && s.checkBtnChecked]}
                                onPress={() => togglePaid(razlikaName)}
                              >
                                {razlikaBill.paid && (
                        <Svg width="16" height="16" viewBox="0 0 24 24">
                          <Polyline points="4,12 9,17 20,6" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </Svg>
                      )}
                              </TouchableOpacity>
                              <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={{ fontSize: 14, fontWeight: '500', color: '#111' }}>{fmt(razlikaBill.amount)}</Text>
                                <View style={[s.statusBadge, razlikaBill.paid ? s.badgePaid : s.badgeUnpaid, { alignSelf: 'flex-start', marginTop: 3 }]}>
                                  <Text style={{ fontSize: 10, fontWeight: '500', color: razlikaBill.paid ? '#16A34A' : '#DC2626' }}>
                                    {razlikaBill.paid ? 'Paid' : 'Unpaid'}
                                  </Text>
                                </View>
                              </View>
                            </View>
                            {razlikaOverdueDays && (
                              <View style={s.overdueRow}>
                                <Text style={s.overdueText}>⚠ Overdue by {razlikaOverdueDays} {razlikaOverdueDays === 1 ? 'day' : 'days'}</Text>
                              </View>
                            )}
                            {razlikaBill.dueDate && !razlikaOverdueDays && razlikaDue && (
                              <View style={s.dueDateRow}>
                                <Text style={s.dueDateText}>{razlikaDue.text}</Text>
                              </View>
                            )}
                            {razlikaBill.notes && (
                              <View style={s.notesRow}>
                                <Text style={s.notesLabel}>Notes: </Text>
                                <Text style={s.notesValue}>{razlikaBill.notes}</Text>
                              </View>
                            )}
                            <View style={s.expandedActions}>
                              <TouchableOpacity style={s.expandedEditBtn} onPress={() => openRazlikaForm(name)}>
                                <Text style={s.expandedEditBtnText}>✎ Edit</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={s.expandedDeleteBtn}
                                onPress={() => setRazlikaDeleteConfirm(name)}
                              >
                                <Text style={s.expandedDeleteBtnText}>✕ Remove</Text>
                              </TouchableOpacity>
                            </View>
                            {razlikaDeleteConfirm === name && (
                              <View style={s.confirmRow}>
                                <Text style={s.confirmMsg}>Remove Razlika for "{name}"?</Text>
                                <View style={s.confirmBtns}>
                                  <TouchableOpacity style={s.confirmNo} onPress={() => setRazlikaDeleteConfirm(null)}>
                                    <Text style={{ fontSize: 12, color: '#374151' }}>Cancel</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity style={s.confirmYes} onPress={() => confirmDeleteRazlika(name)}>
                                    <Text style={{ fontSize: 12, color: '#fff' }}>Remove</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            )}
                          </View>
                        ) : (
                          <Text style={{ fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' }}>No correction bill this month</Text>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          }

          // Check if there's a Razlika even without a main bill
          const orphanRazlika = razlikaCategories.includes(name)
            ? getBill(name + ' - Razlika', curMonth, curYear)
            : null;

          if (orphanRazlika) {
            const isExpanded = expandedBill === name;
            const razlikaName = name + ' - Razlika';
            const razlikaDue = dueBadgeText(orphanRazlika.dueDate, orphanRazlika.paid);
            const razlikaOverdueDays = orphanRazlika.dueDate && !orphanRazlika.paid ? (() => {
              const d = new Date(orphanRazlika.dueDate + 'T00:00:00');
              const today = new Date(); today.setHours(0,0,0,0);
              const diff = Math.round((today - d) / (1000*60*60*24));
              return diff > 0 ? diff : null;
            })() : null;

            return (
              <View key={name} style={s.card}>
                {/* Razlika collapsed row */}
                <View style={s.cardMain}>
                  <TouchableOpacity
                    style={[s.checkBtn, orphanRazlika.paid && s.checkBtnChecked]}
                    onPress={() => togglePaid(razlikaName)}
                  >
                    {orphanRazlika.paid && (
                      <Svg width="16" height="16" viewBox="0 0 24 24">
                        <Polyline points="4,12 9,17 20,6" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </Svg>
                    )}
                  </TouchableOpacity>
                  {orphanRazlika.photoUri
                    ? <TouchableOpacity onPress={() => setLightboxUri(orphanRazlika.photoUri)}>
                        <Image source={{ uri: orphanRazlika.photoUri }} style={s.thumb} />
                      </TouchableOpacity>
                    : <View style={s.thumbPh}>
                        <Text style={{ fontSize: 16 }}>📷</Text>
                      </View>
                  }
                  <View style={s.cardInfo}>
                    <Text style={[s.cardName, orphanRazlika.paid && { textDecorationLine: 'line-through', color: '#9CA3AF' }]}>
                      {name} - Razlika
                    </Text>
                    <View style={s.cardMeta}>
                      <View style={[s.statusBadge, orphanRazlika.paid ? s.badgePaid : s.badgeUnpaid]}>
                        <Text style={{ fontSize: 10, fontWeight: '500', color: orphanRazlika.paid ? '#16A34A' : '#DC2626' }}>
                          {orphanRazlika.paid ? 'Paid' : 'Unpaid'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Text style={s.cardAmount}>{fmt(orphanRazlika.amount)}</Text>
                  <TouchableOpacity
                    style={s.expandBtn}
                    onPress={() => setExpandedBill(isExpanded ? null : name)}
                  >
                    <Text style={s.expandBtnText}>{isExpanded ? '▲' : '▼'}</Text>
                  </TouchableOpacity>
                </View>

                {/* Expanded section */}
                {isExpanded && (
                  <View style={s.expandedSection}>
                    {/* Add main bill button */}
                    <TouchableOpacity
                      style={{ backgroundColor: '#F0FDF4', borderRadius: 8, padding: 10, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: '#BBF7D0' }}
                      onPress={() => { setExpandedBill(null); openForm(name); }}
                    >
                      <Text style={{ fontSize: 13, color: '#16A34A', fontWeight: '500' }}>+ Add main {name} bill</Text>
                    </TouchableOpacity>

                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 8 }}>RAZLIKA (CORRECTION)</Text>
                    {razlikaOverdueDays && (
                      <View style={s.overdueRow}>
                        <Text style={s.overdueText}>⚠ Overdue by {razlikaOverdueDays} {razlikaOverdueDays === 1 ? 'day' : 'days'}</Text>
                      </View>
                    )}
                    {orphanRazlika.dueDate && !razlikaOverdueDays && razlikaDue && (
                      <View style={s.dueDateRow}>
                        <Text style={s.dueDateText}>{razlikaDue.text}</Text>
                      </View>
                    )}
                    {orphanRazlika.notes && (
                      <View style={s.notesRow}>
                        <Text style={s.notesLabel}>Notes: </Text>
                        <Text style={s.notesValue}>{orphanRazlika.notes}</Text>
                      </View>
                    )}
                    <View style={s.expandedActions}>
                      <TouchableOpacity style={s.expandedEditBtn} onPress={() => openRazlikaForm(name)}>
                        <Text style={s.expandedEditBtnText}>✎ Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.expandedDeleteBtn}
                        onPress={() => setRazlikaDeleteConfirm(name)}
                      >
                        <Text style={s.expandedDeleteBtnText}>✕ Remove</Text>
                      </TouchableOpacity>
                    </View>
                    {razlikaDeleteConfirm === name && (
                      <View style={s.confirmRow}>
                        <Text style={s.confirmMsg}>Remove Razlika for "{name}"?</Text>
                        <View style={s.confirmBtns}>
                          <TouchableOpacity style={s.confirmNo} onPress={() => setRazlikaDeleteConfirm(null)}>
                            <Text style={{ fontSize: 12, color: '#374151' }}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={s.confirmYes} onPress={() => confirmDeleteRazlika(name)}>
                            <Text style={{ fontSize: 12, color: '#fff' }}>Remove</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          }

          return (
            <TouchableOpacity key={name} style={s.placeholder} onPress={() => openForm(name)}>
              <View style={s.placeholderIcon}>
                <Text style={{ color: '#9CA3AF', fontSize: 16 }}>+</Text>
              </View>
              <Text style={s.placeholderName}>{name}</Text>
              {!reorderMode && <Text style={s.placeholderCta}>Tap to add ›</Text>}
              {reorderMode && (
                <View style={{ flexDirection: 'row', marginLeft: 8 }}>
                  <TouchableOpacity onPress={() => moveCategory(name, -1)} style={[s.orderBtn, { backgroundColor: '#D1D5DB' }]}>
                    <Text style={s.orderBtnText}>▲</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => moveCategory(name, 1)} style={[s.orderBtn, { marginLeft: 4, backgroundColor: '#D1D5DB' }]}>
                    <Text style={s.orderBtnText}>▼</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          );
     })}
      </ScrollView>

      <Modal visible={showMonthPicker} animationType="fade" transparent onRequestClose={() => setShowMonthPicker(false)}>
  <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
<View style={{ backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '80%' }}>
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#111' }}>Pick a month</Text>
        <TouchableOpacity
          onPress={() => setShowMonthPicker(false)}
          style={{ backgroundColor: '#F3F4F6', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 16, color: '#6B7280' }}>✕</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <TouchableOpacity
          onPress={() => setCurYear(y => y - 1)}
          style={{ width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
        >
          <Text style={{ fontSize: 20, color: '#6B7280' }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#111', minWidth: 60, textAlign: 'center' }}>{curYear}</Text>
        <TouchableOpacity
          onPress={() => setCurYear(y => y + 1)}
          style={{ width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', marginLeft: 12 }}
        >
          <Text style={{ fontSize: 20, color: '#6B7280' }}>›</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {MONTHS.map((name, idx) => (
          <TouchableOpacity
            key={idx}
            onPress={() => { setCurMonth(idx); setShowMonthPicker(false); }}
            style={{
              width: '23%', paddingVertical: 12, alignItems: 'center',
              backgroundColor: curMonth === idx ? '#2D3F51' : '#F9FAFB',
              borderRadius: 8, marginBottom: 8, marginHorizontal: '1%',
              borderWidth: 1, borderColor: curMonth === idx ? '#2D3F51' : '#E5E7EB'
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: curMonth === idx ? '600' : '400', color: curMonth === idx ? '#fff' : '#111' }}>
              {name.slice(0, 3)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
  </ScrollView>
  </View>
  </View>
</Modal>

      {/* ── Manage modal ── */}


<Modal visible={scannerVisible} animationType="fade" onRequestClose={() => setScannerVisible(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
       <CameraView
  style={{ flex: 1 }}
  facing="back"
  onBarcodeScanned={handleQRScan}
/>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 250, height: 250, borderWidth: 2, borderColor: '#F6C824', borderRadius: 12 }} />
            <Text style={{ color: '#fff', marginTop: 20, fontSize: 14 }}>Point at a bill QR code</Text>
          </View>
          <TouchableOpacity
            onPress={() => setScannerVisible(false)}
            style={{ position: 'absolute', top: 50, right: 20, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: '#fff', fontSize: 18 }}>✕</Text>
          </TouchableOpacity>
        </View>
      </Modal>

<Modal visible={!!monthSwitchPrompt} animationType="fade" transparent onRequestClose={() => setMonthSwitchPrompt(null)}>
  <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
    <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%' }}>
      <Text style={{ fontSize: 16, fontWeight: '600', color: '#111', marginBottom: 10 }}>Different month detected</Text>
      <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 24, lineHeight: 20 }}>
        This bill is for <Text style={{ fontWeight: '600', color: '#111' }}>{monthSwitchPrompt?.billMonthName}</Text> but you are viewing <Text style={{ fontWeight: '600', color: '#111' }}>{monthSwitchPrompt?.curMonthName}</Text>.
      </Text>
      <TouchableOpacity
        onPress={monthSwitchPrompt?.onSwitch}
        style={{ backgroundColor: '#2D3F51', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginBottom: 10 }}
      >
        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Switch to {monthSwitchPrompt?.billMonthName}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={monthSwitchPrompt?.onStay}
        style={{ backgroundColor: '#F9FAFB', borderRadius: 10, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' }}
      >
        <Text style={{ color: '#374151', fontWeight: '500', fontSize: 14 }}>Stay in {monthSwitchPrompt?.curMonthName}</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>


      {/* ── Bill entry modal ── */}
      <Modal visible={modalVisible} animationType="fade" transparent onRequestClose={() => setModalVisible(false)}>
  <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
    <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '90%' }}>
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 80 }}>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#111' }}>
          {getBill(editSlot, curMonth, curYear) ? 'Edit — ' : 'Add — '}{editSlot}
        </Text>
        <TouchableOpacity
          onPress={() => setModalVisible(false)}
          style={{ backgroundColor: '#F3F4F6', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 16, color: '#6B7280' }}>✕</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.formLabel}>Amount (€)</Text>
<View style={{ flexDirection: 'row', alignItems: 'center' }}>
  <TextInput
    style={[s.input, { flex: 1, marginBottom: 0 }]}
    keyboardType="decimal-pad"
    value={amount}
    onChangeText={setAmount}
    placeholder="0.00"
  />
  {editSlot === 'Struja - Zajednička' && (
    <TouchableOpacity
      style={{ marginLeft: 8, backgroundColor: '#2D3F51', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12 }}
      onPress={() => {
        const val = parseFloat(amount);
        if (!isNaN(val) && val > 0) setAmount((val / 3).toFixed(2));
      }}
    >
      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>÷ 3</Text>
    </TouchableOpacity>
  )}
</View>

      <Text style={s.formLabel}>Due date</Text>
      <TouchableOpacity
        style={[s.dateInput, { justifyContent: 'center' }]}
        onPress={() => setShowDatePicker(true)}
      >
        <Text style={{ fontSize: 14, color: dueDate ? '#111' : '#9CA3AF' }}>
          {dueDate ? dueDate : 'Tap to select date'}
        </Text>
      </TouchableOpacity>
      {showDatePicker && (
        <DateTimePicker
          value={dueDate ? new Date(dueDate + 'T00:00:00') : new Date()}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              const y = selectedDate.getFullYear();
              const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
              const d = String(selectedDate.getDate()).padStart(2, '0');
              setDueDate(y + '-' + m + '-' + d);
            }
          }}
        />
      )}

     


      <Text style={s.formLabel}>Notes (optional)</Text>
      <TextInput
        style={s.input}
        value={notes}
        onChangeText={setNotes}
        placeholder="e.g. auto-pay"
      />


      <Text style={s.formLabel}>Bill photo</Text>
      <View style={{ flexDirection: 'row', marginTop: 4 }}>
        <TouchableOpacity
          style={{ flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 11, alignItems: 'center', backgroundColor: '#F9FAFB' }}
          onPress={takePhoto}
        >
          <Text style={{ fontSize: 13, color: '#111' }}>📷 Take photo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 11, alignItems: 'center', backgroundColor: '#F9FAFB', marginLeft: 8 }}
          onPress={pickPhoto}
        >
          <Text style={{ fontSize: 13, color: '#111' }}>🖼 Gallery</Text>
        </TouchableOpacity>
      </View>

      {photoUri && (
        <View style={{ marginTop: 8, borderRadius: 10, overflow: 'hidden' }}>
          <Image source={{ uri: photoUri }} style={{ width: '100%', height: 150 }} resizeMode="contain" />
          <TouchableOpacity
            style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }}
            onPress={() => setPhotoUri(null)}
          >
            <Text style={{ color: '#fff', fontSize: 12 }}>Remove</Text>
          </TouchableOpacity>
        </View>
      )}
<View style={{ height: 1, backgroundColor: '#E5E7EB', marginTop: 24, marginBottom: 8 }} />
      {razlikaCategories.includes(editSlot) && (
            
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 4, padding: 12, backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' }}
            onPress={() => {
              setRazlikaSlot(editSlot);
              const existing = getBill(editSlot + ' - Razlika', curMonth, curYear);
              setRazlikaAmount(existing ? String(existing.amount) : '');
              setRazlikaDueDate(existing && existing.dueDate ? existing.dueDate : '');
              setRazlikaNotes(existing && existing.notes ? existing.notes : '');
              setRazlikaPhotoUri(existing && existing.photoUri ? existing.photoUri : null);
              setModalVisible(false);
              setRazlikaModalVisible(true);
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: '#111' }}>
                {getBill(editSlot + ' - Razlika', curMonth, curYear) ? '✎ Edit Razlika (correction bill)' : '+ Add Razlika (correction bill)'}
              </Text>
              <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Tap to open Razlika form</Text>
            </View>
            <Text style={{ fontSize: 18, color: '#2D3F51' }}>›</Text>
          </TouchableOpacity>
        )}

      <View style={{ flexDirection: 'row', marginTop: 16 }}>
        <TouchableOpacity
          style={{ borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 12, marginRight: 8 }}
          onPress={() => setModalVisible(false)}
        >
          <Text style={{ fontSize: 14, color: '#374151' }}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: '#2D3F51', borderRadius: 8, paddingVertical: 12, alignItems: 'center' }}
          onPress={submitForm}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Save</Text>
        </TouchableOpacity>
      </View>

   </ScrollView>
    </View>
  </View>
</Modal>

      {/* ── Manage modal ── */}
      <Modal visible={manageVisible} animationType="slide" transparent onRequestClose={() => { setManageVisible(false); setCatDeleteConfirm(null); }}>
  <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
    <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 40, maxHeight: 580 }}>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#111' }}>Manage categories</Text>
        <TouchableOpacity
          onPress={() => { setManageVisible(false); setCatDeleteConfirm(null); }}
          style={{ backgroundColor: '#F3F4F6', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 16, color: '#6B7280' }}>✕</Text>
        </TouchableOpacity>
      </View>

      <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 10, padding: 10, backgroundColor: '#F9FAFB', borderRadius: 8 }}>
        Changes apply from {MONTHS[curMonth]} {curYear} onwards.
      </Text>

      {/* Confirmation shown OUTSIDE ScrollView */}
      {catDeleteConfirm && (
        <View style={{ backgroundColor: '#FEE2E2', borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <Text style={{ fontSize: 13, color: '#DC2626', marginBottom: 10 }}>
            Hide "{catDeleteConfirm}" from {MONTHS[curMonth]} {curYear} onwards?
          </Text>
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity
              onPress={() => setCatDeleteConfirm(null)}
              style={{ flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginRight: 8, backgroundColor: '#fff' }}
            >
              <Text style={{ fontSize: 13, color: '#374151' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => confirmDeleteCat(catDeleteConfirm)}
              style={{ flex: 1, backgroundColor: '#DC2626', borderRadius: 8, paddingVertical: 10, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 13, color: '#fff', fontWeight: '600' }}>Yes, remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Category list */}
      <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
        {getActiveNames(curMonth, curYear).map(name => (
          <View key={name} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 8, padding: 12, marginBottom: 6 }}>
            <Text style={{ flex: 1, fontSize: 14, color: '#111' }}>{name}</Text>
            <TouchableOpacity
              onPress={() => setCatDeleteConfirm(catDeleteConfirm === name ? null : name)}
              style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}
            >
              <Text style={{ color: '#DC2626', fontSize: 13 }}>Remove</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {/* Add new */}
     <View style={{ flexDirection: 'row', marginTop: 12 }}>
  <TextInput
    style={{ flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 14, marginRight: 8 }}
    value={newCatName}
    onChangeText={setNewCatName}
    placeholder="New bill name..."
    onSubmitEditing={addCategory}
  />
  <TouchableOpacity
    onPress={addCategory}
    style={{ backgroundColor: '#111', borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' }}
  >
    <Text style={{ color: '#fff', fontSize: 13 }}>+ Add</Text>
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

      <TouchableOpacity
        onPress={() => { setManageVisible(false); setCatDeleteConfirm(null); }}
        style={{ backgroundColor: '#111', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 12 }}
      >
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Done</Text>
      </TouchableOpacity>

      <View style={{ height: 1, backgroundColor: '#E5E7EB', marginTop: 16, marginBottom: 12 }} />
      <Text style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Backup & Restore</Text>
      <TouchableOpacity
        onPress={() => { setManageVisible(false); exportCSV(); }}
        style={{ backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}
      >
        <Text style={{ fontSize: 20, marginRight: 12 }}>⬇️</Text>
        <View>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#111' }}>Export to CSV</Text>
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>Save all bills to a file</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => { setManageVisible(false); importCSV(); }}
        style={{ backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center' }}
      >
        <Text style={{ fontSize: 20, marginRight: 12 }}>⬆️</Text>
        <View>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#111' }}>Import from CSV</Text>
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>Merge with existing data</Text>
        </View>
      </TouchableOpacity>

    </View>
  </View>
</Modal>


<Modal visible={backupVisible} animationType="slide" transparent onRequestClose={() => setBackupVisible(false)}>
  <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
    <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 40 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#111' }}>💾 Backup & Restore</Text>
        <TouchableOpacity
          onPress={() => setBackupVisible(false)}
          style={{ backgroundColor: '#F3F4F6', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 16, color: '#6B7280' }}>✕</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        onPress={() => { setBackupVisible(false); exportCSV(); }}
        style={{ backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}
      >
        <Text style={{ fontSize: 24, marginRight: 14 }}>⬇️</Text>
        <View>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#111' }}>Export to CSV</Text>
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Save all bills to a file</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => { setBackupVisible(false); importCSV(); }}
        style={{ backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}
      >
        <Text style={{ fontSize: 24, marginRight: 14 }}>⬆️</Text>
        <View>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#111' }}>Import from CSV</Text>
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Merge with existing data</Text>
        </View>
      </TouchableOpacity>
      <Text style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 4 }}>
        Import merges with existing data — nothing is deleted
      </Text>
    </View>
  </View>
</Modal>


<Modal visible={razlikaModalVisible} animationType="fade" transparent onRequestClose={() => setRazlikaModalVisible(false)}>
  <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
<View style={{ backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '90%' }}>
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 80 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#111' }}>
          {razlikaSlot} — Razlika
        </Text>
        <TouchableOpacity
          onPress={() => setRazlikaModalVisible(false)}
          style={{ backgroundColor: '#F3F4F6', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 16, color: '#6B7280' }}>✕</Text>
        </TouchableOpacity>
      </View>
     <Text style={s.formLabel}>Amount (€)</Text>
<View style={{ flexDirection: 'row', alignItems: 'center' }}>
  <TextInput
    style={[s.input, { flex: 1, marginBottom: 0 }]}
    keyboardType="decimal-pad"
    value={razlikaAmount}
    onChangeText={setRazlikaAmount}
    placeholder="0.00"
  />
  {razlikaSlot === 'Struja - Zajednička' && (
    <TouchableOpacity
      style={{ marginLeft: 8, backgroundColor: '#2D3F51', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12 }}
      onPress={() => {
        const val = parseFloat(razlikaAmount);
        if (!isNaN(val) && val > 0) setRazlikaAmount((val / 3).toFixed(2));
      }}
    >
      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>÷ 3</Text>
    </TouchableOpacity>
  )}
</View>
      <Text style={s.formLabel}>Due date</Text>
      <TouchableOpacity
        style={{ borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 10, height: 52, justifyContent: 'center', marginBottom: 4 }}
        onPress={() => setShowRazlikaDatePicker(true)}
      >
        <Text style={{ fontSize: 14, color: razlikaDueDate ? '#111' : '#9CA3AF' }}>
          {razlikaDueDate ? razlikaDueDate : 'Tap to select date'}
        </Text>
      </TouchableOpacity>
      {showRazlikaDatePicker && (
        <DateTimePicker
          value={razlikaDueDate ? new Date(razlikaDueDate + 'T00:00:00') : new Date()}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowRazlikaDatePicker(false);
            if (selectedDate) {
              const y = selectedDate.getFullYear();
              const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
              const d = String(selectedDate.getDate()).padStart(2, '0');
              setRazlikaDueDate(y + '-' + m + '-' + d);
            }
          }}
        />
      )}
      <Text style={s.formLabel}>Notes (optional)</Text>
      <TextInput
        style={s.input}
        value={razlikaNotes}
        onChangeText={setRazlikaNotes}
        placeholder="e.g. positive correction"
      />
      <Text style={s.formLabel}>Bill photo</Text>
      <View style={{ flexDirection: 'row', marginTop: 4 }}>
        <TouchableOpacity
          style={{ flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 11, alignItems: 'center', backgroundColor: '#F9FAFB' }}
          onPress={takeRazlikaPhoto}
        >
          <Text style={{ fontSize: 13, color: '#111' }}>📷 Take photo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 11, alignItems: 'center', backgroundColor: '#F9FAFB', marginLeft: 8 }}
          onPress={pickRazlikaPhoto}
        >
          <Text style={{ fontSize: 13, color: '#111' }}>🖼 Gallery</Text>
        </TouchableOpacity>
      </View>
      {razlikaPhotoUri && (
        <View style={{ marginTop: 8, borderRadius: 10, overflow: 'hidden' }}>
          <Image source={{ uri: razlikaPhotoUri }} style={{ width: '100%', height: 150 }} resizeMode="contain" />
          <TouchableOpacity
            style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }}
            onPress={() => setRazlikaPhotoUri(null)}
          >
            <Text style={{ color: '#fff', fontSize: 12 }}>Remove</Text>
          </TouchableOpacity>
        </View>
      )}
  <View style={{ flexDirection: 'row', marginTop: 16 }}>
        <TouchableOpacity
          style={{ borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 12, marginRight: 8 }}
          onPress={() => setRazlikaModalVisible(false)}
        >
          <Text style={{ fontSize: 14, color: '#374151' }}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: '#111', borderRadius: 8, paddingVertical: 12, alignItems: 'center' }}
          onPress={submitRazlika}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Save</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
    </View>
  </View>
</Modal>

      {/* ── Lightbox ── */}
      <Modal visible={!!lightboxUri} animationType="fade" transparent onRequestClose={() => setLightboxUri(null)}>
        <TouchableOpacity style={s.lightbox} onPress={() => setLightboxUri(null)}>
          {lightboxUri && <Image source={{ uri: lightboxUri }} style={s.lightboxImg} resizeMode="contain" />}
          <TouchableOpacity style={s.lightboxClose} onPress={() => setLightboxUri(null)}>
            <Text style={{ color: '#fff', fontSize: 18 }}>✕</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    {toast && (
        <View style={s.toast}>
          <Text style={s.toastText}>{toast}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: '600', color: '#111' },
  sub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18 },
  navBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', marginHorizontal: 8 },
  navBtnText: { fontSize: 20, color: '#6B7280' },
  monthLabel: { fontSize: 15, fontWeight: '500', color: '#111', width: 160, textAlign: 'center' },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, marginHorizontal: 3, alignItems: 'center' },
  statLabel: { fontSize: 10, color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 4, textAlign: 'center' },
  statVal: { fontSize: 18, fontWeight: '600', color: '#111', textAlign: 'center' },
  progressWrap: { paddingHorizontal: 16, marginBottom: 12 },
  progressLabel: { fontSize: 11, color: '#9CA3AF', marginBottom: 5 },
 progressTrack: { height: 7, backgroundColor: '#E5E7EB', borderRadius: 99 },
progressFill: { height: 7, backgroundColor: '#2D3F51', borderRadius: 99 },
  list: { flex: 1, paddingHorizontal: 16 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, marginBottom: 8 },
  cardPaid: { opacity: 0.6 },
  cardMain: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  checkBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  checkBtnChecked: { backgroundColor: '#DCFCE7', borderColor: '#16A34A' },
  checkMark: { color: '#16A34A', fontSize: 22, fontWeight: '300' },
  thumb: { width: 40, height: 40, borderRadius: 8, marginRight: 10 },
  thumbPh: { width: 40, height: 40, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 14, fontWeight: '500', color: '#111' },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 3 },
  dueBadge: { fontSize: 11 },
  notesText: { fontSize: 11, color: '#9CA3AF', marginRight: 5 },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99 },
  badgePaid: { backgroundColor: '#DCFCE7' },
  badgeUnpaid: { backgroundColor: '#FEE2E2' },
  cardAmount: { fontSize: 15, fontWeight: '500', color: '#111', marginLeft: 6 },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  iconBtnText: { color: '#9CA3AF', fontSize: 18 },
  confirmRow: { backgroundColor: '#FEE2E2', padding: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, borderRadius: 8 },
  confirmMsg: { fontSize: 12, color: '#DC2626', flex: 1 },
  confirmBtns: { flexDirection: 'row' },
  confirmNo: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, marginRight: 6 },
  confirmYes: { backgroundColor: '#DC2626', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  placeholder: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  placeholderIcon: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  placeholderName: { flex: 1, fontSize: 14, color: '#9CA3AF' },
  placeholderCta: { fontSize: 12, color: '#9CA3AF' },
  formLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 14, marginBottom: 4 },
dateInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 16, fontSize: 14, marginBottom: 4, minHeight: 56 },  photoBtnsRow: { flexDirection: 'row', marginTop: 4 },
  photoBtn: { flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 11, alignItems: 'center', backgroundColor: '#F9FAFB' },
  photoBtnText: { fontSize: 13, color: '#111' },
  photoPreviewWrap: { marginTop: 8, borderRadius: 10, overflow: 'hidden' },
  photoPreview: { width: 340, height: 180 },
  removePhotoBtn: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  formActions: { flexDirection: 'row', marginTop: 14 },
  cancelBtn: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10, marginRight: 8 },
  saveBtn: { flex: 1, backgroundColor: '#111', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  lightbox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center' },
  lightboxImg: { width: 380, height: 500 },
  lightboxClose: { position: 'absolute', top: 50, right: 16, backgroundColor: 'rgba(255,255,255,0.15)', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dueBadgeWrap: { borderRadius: 99, paddingHorizontal: 6, paddingVertical: 1, marginRight: 5 },
  toast: { position: 'absolute', top: 60, left: 16, right: 16, backgroundColor: '#16A34A', borderRadius: 10, padding: 14, alignItems: 'center', zIndex: 999 },
  toastText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  expandBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  expandBtnText: { color: '#9CA3AF', fontSize: 12 },
  expandedSection: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingHorizontal: 14, paddingVertical: 12 },
  overdueRow: { backgroundColor: '#FEF3C7', borderRadius: 8, padding: 8, marginBottom: 8 },
  overdueText: { fontSize: 13, color: '#92400E', fontWeight: '500' },
  dueDateRow: { marginBottom: 8 },
  dueDateText: { fontSize: 13, color: '#6B7280' },
  notesRow: { flexDirection: 'row', marginBottom: 10 },
  notesLabel: { fontSize: 13, color: '#9CA3AF' },
  notesValue: { fontSize: 13, color: '#374151', flex: 1 },
  expandedActions: { flexDirection: 'row' },
  expandedEditBtn: { flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingVertical: 9, alignItems: 'center', marginRight: 8 },
  expandedEditBtnText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  expandedDeleteBtn: { flex: 1, backgroundColor: '#FEE2E2', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  expandedDeleteBtnText: { fontSize: 13, color: '#DC2626', fontWeight: '500' },
 scanBtn: { backgroundColor: '#2D3F51', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  scanBtnText: { fontSize: 13, fontWeight: '600', color: '#fff', letterSpacing: 0.3 },
 orderBtn: { width: 22, height: 22, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  orderBtnText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  });