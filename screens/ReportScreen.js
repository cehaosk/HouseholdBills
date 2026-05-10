import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Platform
} from 'react-native';
import * as SecureStore from 'expo-secure-store';

const MONTHS_LONG = [
  'Siječanj','Veljača','Ožujak','Travanj','Svibanj','Lipanj',
  'Srpanj','Kolovoz','Rujan','Listopad','Studeni','Prosinac'
];
const MONTHS_SHORT = ['Sij','Velj','Ožu','Tra','Svi','Lip','Srp','Kol','Ruj','Lis','Stu','Pro'];
const BILLS_KEY = 'hh-bills-v1';

export default function ReportScreen({ onNavigateToBills }) {
  const [bills, setBills] = useState([]);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [compareOn, setCompareOn] = useState(false);
  const [openCats, setOpenCats] = useState(new Set());
  const CATS_KEY = 'hh-cats-v1';
  const [categories, setCategories] = useState([]);

  useEffect(() => { loadBills(); }, []);

  useEffect(() => {
    const interval = setInterval(loadBills, 2000);
    return () => clearInterval(interval);
  }, []);

 async function loadBills() {
    try {
      const b = await SecureStore.getItemAsync(BILLS_KEY);
      if (b) setBills(JSON.parse(b));
      const c = await SecureStore.getItemAsync(CATS_KEY);
      if (c) setCategories(JSON.parse(c));
    } catch (e) { console.log(e); }
  }

  function fmt(n) { return '€' + parseFloat(n || 0).toFixed(2); }

  function getMonthTotal(m, y) {
    return bills.filter(b => b.month === m && b.year === y)
      .reduce((s, b) => s + (b.amount || 0), 0);
  }
  function getMonthPaid(m, y) {
    return bills.filter(b => b.month === m && b.year === y && b.paid)
      .reduce((s, b) => s + (b.amount || 0), 0);
  }
const razlikaCats = categories
    .filter(c => c.hasRazlika && !c.deletedFrom)
    .map(c => c.name);

  function getCatYearData(name, year) {
    return Array.from({ length: 12 }, (_, m) => {
      const b = bills.find(x => x.name === name && x.month === m && x.year === year);
      const razlika = razlikaCats.includes(name)
        ? bills.find(x => x.name === name + ' - Razlika' && x.month === m && x.year === year)
        : null;
      return (b ? b.amount : 0) + (razlika ? razlika.amount : 0);
    });
  }

  const prevYear = reportYear - 1;
  const curData = Array.from({ length: 12 }, (_, m) => ({
    total: getMonthTotal(m, reportYear),
    paid: getMonthPaid(m, reportYear),
  }));
  const prevData = Array.from({ length: 12 }, (_, m) => ({
    total: getMonthTotal(m, prevYear),
  }));
  const hasPrev = prevData.some(d => d.total > 0);
  const showCmp = compareOn && hasPrev;
  const yearTotal = curData.reduce((s, d) => s + d.total, 0);
  const yearPaid = curData.reduce((s, d) => s + d.paid, 0);
  const prevTotal = prevData.reduce((s, d) => s + d.total, 0);
  const allYearBills = bills.filter(b => b.year === reportYear);
  const payRate = allYearBills.length
    ? Math.round((allYearBills.filter(b => b.paid).length / allYearBills.length) * 100)
    : 0;
  const yoy = prevTotal > 0
    ? (((yearTotal - prevTotal) / prevTotal) * 100).toFixed(1)
    : null;
  const allMax = Math.max(
    ...curData.map(d => d.total),
    ...(showCmp ? prevData.map(d => d.total) : [0]),
    1
  );

  const nameSet = new Set();
  bills.filter(b => b.year === reportYear).forEach(b => {
    // Don't show Razlika as separate category — it's included in the main category
    if (!b.name.endsWith(' - Razlika')) nameSet.add(b.name);
  });
  const catNames = [...nameSet].sort((a, b) => {
    const catA = categories.find(c => c.name === a && !c.deletedFrom);
    const catB = categories.find(c => c.name === b && !c.deletedFrom);
    const orderA = catA?.order !== undefined ? catA.order : 9999;
    const orderB = catB?.order !== undefined ? catB.order : 9999;
    return orderA - orderB;
  });

  const monthTotals = Array.from({ length: 12 }, (_, m) =>
    allYearBills.filter(b => b.month === m).reduce((s, b) => s + (b.amount || 0), 0)
  );
  const withData = monthTotals.filter(t => t > 0);
  const avgMonthly = withData.length
    ? withData.reduce((s, t) => s + t, 0) / withData.length
    : 0;
  const highM = monthTotals.indexOf(Math.max(...monthTotals, 0));
  const catTotals = {};
  allYearBills.forEach(b => {
    if (!catTotals[b.name]) catTotals[b.name] = { s: 0, c: 0 };
    catTotals[b.name].s += b.amount || 0;
    catTotals[b.name].c++;
  });
  const catAvgs = Object.entries(catTotals)
    .map(([n, { s, c }]) => ({ n, avg: s / c }))
    .sort((a, b) => b.avg - a.avg);
  const maxAvg = catAvgs[0] ? catAvgs[0].avg : 1;

  function toggleCat(name) {
    const next = new Set(openCats);
    if (next.has(name)) next.delete(name); else next.add(name);
    setOpenCats(next);
  }



  function MiniBar({ pct, color, height }) {
    const h = height || 8;
    const filled = Math.max(0, Math.min(100, Math.round(pct)));
    const empty = 100 - filled;
    return (
      <View style={{ flex: 1, height: h, backgroundColor: '#E5E7EB', borderRadius: 99, flexDirection: 'row', overflow: 'hidden' }}>
        <View style={{ flex: filled > 0 ? filled : 0, height: h, backgroundColor: filled > 0 ? color : 'transparent' }} />
        <View style={{ flex: empty > 0 ? empty : 0, height: h }} />
      </View>
    );
  }

  function SplitBar({ total, paid, max, height }) {
    const h = height || 7;
    const paidPct = Math.max(0, Math.min(100, Math.round((paid / max) * 100)));
    const unpaidPct = Math.max(0, Math.min(100, Math.round(((total - paid) / max) * 100)));
    const emptyPct = Math.max(0, 100 - paidPct - unpaidPct);
    return (
      <View style={{ flex: 1, height: h, backgroundColor: '#E5E7EB', borderRadius: 99, flexDirection: 'row', overflow: 'hidden' }}>
        {paidPct > 0 && <View style={{ flex: paidPct, height: h, backgroundColor: '#2D3F51' }} />}
        {unpaidPct > 0 && <View style={{ flex: unpaidPct, height: h, backgroundColor: '#DC2626' }} />}
        {emptyPct > 0 && <View style={{ flex: emptyPct, height: h }} />}
      </View>
    );
  }

  function DiffPill({ diff }) {
    if (diff === null || diff === undefined) return null;
    const up = diff > 0;
    return (
      <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99, backgroundColor: up ? '#FEE2E2' : '#DCFCE7', marginLeft: 4 }}>
        <Text style={{ fontSize: 10, color: up ? '#DC2626' : '#16A34A' }}>
          {up ? '+' : ''}{fmt(diff)}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>

        <Text style={s.title}>Year Report</Text>

        <View style={s.yearNav}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity style={s.navBtn} onPress={() => setReportYear(y => y - 1)}>
              <Text style={s.navBtnText}>‹</Text>
            </TouchableOpacity>
            <Text style={s.yearLabel}>{reportYear}</Text>
            <TouchableOpacity style={s.navBtn} onPress={() => setReportYear(y => y + 1)}>
              <Text style={s.navBtnText}>›</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[s.cmpToggle, showCmp && s.cmpToggleOn]}
            onPress={() => hasPrev && setCompareOn(!compareOn)}
          >
            <View style={[s.pip, showCmp && s.pipOn]} />
            <Text style={[s.cmpText, showCmp && s.cmpTextOn]}>
              {showCmp ? 'vs ' + prevYear : 'Compare ' + prevYear}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={s.ig}>
          <View style={s.ic}>
            <Text style={s.icLabel}>{reportYear} TOTAL</Text>
            <Text style={s.icVal}>{fmt(yearTotal)}</Text>
          </View>
          <View style={s.ic}>
            <Text style={s.icLabel}>PAID</Text>
            <Text style={[s.icVal, { color: '#16A34A' }]}>{fmt(yearPaid)}</Text>
          </View>
        </View>
        {showCmp && (
          <View style={s.ig}>
            <View style={s.ic}>
              <Text style={s.icLabel}>VS {prevYear}</Text>
              <Text style={[s.icVal, { color: yearTotal >= prevTotal ? '#DC2626' : '#16A34A' }]}>
                {yoy !== null ? (yearTotal >= prevTotal ? '+' : '') + yoy + '%' : '—'}
              </Text>
              <Text style={s.icSub}>{prevYear}: {fmt(prevTotal)}</Text>
            </View>
          </View>
        )}

        <Text style={s.sectionTitle}>MONTHLY SPEND — {reportYear}</Text>
        {curData.map((d, m) => {
          const isCur = m === new Date().getMonth() && reportYear === new Date().getFullYear();
          const cPct = Math.round((d.total / allMax) * 100);
          const pPct = showCmp ? Math.round((prevData[m].total / allMax) * 100) : 0;
          const diff = showCmp && prevData[m].total > 0 ? d.total - prevData[m].total : null;
          return (
            <TouchableOpacity key={m} style={[s.mrow, isCur && s.mrowCur]} onPress={() => onNavigateToBills(m, reportYear)}>
              <Text style={s.mrowLabel}>{MONTHS_SHORT[m]}</Text>
              <View style={s.mrowBars}>
                <View style={s.barLine}>
                  <Text style={s.barYearLabel}>{reportYear}</Text>
                  <SplitBar total={d.total} paid={d.paid} max={allMax} height={7} />
                </View>
                {showCmp && (
                  <View style={[s.barLine, { marginTop: 3 }]}>
                    <Text style={[s.barYearLabel, { color: '#9CA3AF' }]}>{prevYear}</Text>
                    <MiniBar pct={pPct} color="#B4B2A9" height={7} />
                  </View>
                )}
              </View>
              <View style={{ alignItems: 'flex-end', minWidth: 60 }}>
                <Text style={[s.mrowAmt, (d.total - d.paid) > 0 && { color: '#DC2626' }]}>
                  {d.total > 0 ? fmt(d.total) : '—'}
                </Text>
                {showCmp && diff !== null && <DiffPill diff={diff} />}
              </View>
            </TouchableOpacity>
          );
        })}

        <Text style={[s.sectionTitle, { marginTop: 24 }]}>BREAKDOWN BY CATEGORY</Text>
        {catNames.length === 0 && (
          <Text style={s.empty}>No data for {reportYear} yet.</Text>
        )}
        {catNames.map(name => {
          const curAmts = getCatYearData(name, reportYear);
          const prevAmts = getCatYearData(name, prevYear);
          const curTotal = curAmts.reduce((s, v) => s + v, 0);
          const prevCatTotal = prevAmts.reduce((s, v) => s + v, 0);
          const diff = showCmp && prevCatTotal > 0 ? curTotal - prevCatTotal : null;
          const isOpen = openCats.has(name);
          const maxVal = Math.max(...curAmts, showCmp ? Math.max(...prevAmts) : 0, 1);
          const months = curAmts.filter(v => v > 0).length;
          const avg = months > 0 ? curTotal / months : 0;
          const prevAvgM = prevAmts.filter(v => v > 0).length;
          const prevAvg = prevAvgM > 0 ? prevCatTotal / prevAvgM : 0;

          return (
            <View key={name} style={[s.ccatRow, isOpen && s.ccatRowOpen]}>
              <TouchableOpacity style={s.ccatHeader} onPress={() => toggleCat(name)}>
                <Text style={s.ccatName}>{name}</Text>
                <Text style={s.ccatTotal}>{curTotal > 0 ? fmt(curTotal) : '—'}</Text>
                <DiffPill diff={diff} />
                <Text style={s.chevron}>{isOpen ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {isOpen && (
                <View style={s.ccatBody}>
                  <View style={s.ccatStats}>
                    <View style={s.ccatStat}>
                      <Text style={s.ccatStatLabel}>YEAR TOTAL</Text>
                      <Text style={s.ccatStatVal}>{fmt(curTotal)}</Text>
                    </View>
                    <View style={s.ccatStat}>
                      <Text style={s.ccatStatLabel}>MONTHLY AVG</Text>
                      <Text style={s.ccatStatVal}>{fmt(avg)}</Text>
                      <Text style={s.ccatStatSub}>{months} months</Text>
                    </View>
                    {showCmp && prevCatTotal > 0 && (
                      <View style={s.ccatStat}>
                        <Text style={s.ccatStatLabel}>{prevYear} TOTAL</Text>
                        <Text style={[s.ccatStatVal, { color: '#6B7280' }]}>{fmt(prevCatTotal)}</Text>
                        <Text style={s.ccatStatSub}>avg {fmt(prevAvg)}/mo</Text>
                      </View>
                    )}
                  </View>
                  {MONTHS_SHORT.map((label, m) => {
                    const cur = curAmts[m];
                    const prev = prevAmts[m];
                    if (cur === 0 && (!showCmp || prev === 0)) return null;
                    const cPct = Math.round((cur / maxVal) * 100);
                    const pPct = showCmp ? Math.round((prev / maxVal) * 100) : 0;
                    const mDiff = showCmp && prev > 0 ? cur - prev : null;
                    return (
                      <View key={m} style={s.ccatMrow}>
                        <Text style={s.ccatMrowLabel}>{label}</Text>
                        <View style={s.mrowBars}>
                          <View style={s.barLine}>
                            <Text style={s.barYearLabel}>{reportYear}</Text>
                            <MiniBar pct={cPct} color="#2D3F51" height={6} />
                          </View>
                          {showCmp && prev > 0 && (
                            <View style={[s.barLine, { marginTop: 2 }]}>
                              <Text style={[s.barYearLabel, { color: '#9CA3AF' }]}>{prevYear}</Text>
                              <MiniBar pct={pPct} color="#B4B2A9" height={6} />
                            </View>
                          )}
                        </View>
                        <Text style={s.ccatMrowAmt}>{cur > 0 ? fmt(cur) : '—'}</Text>
                        <DiffPill diff={mDiff} />
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        <Text style={[s.sectionTitle, { marginTop: 24 }]}>INSIGHTS</Text>
        {allYearBills.length === 0 ? (
          <Text style={s.empty}>No data for {reportYear} yet.</Text>
        ) : (
          <View>
            <View style={s.insightRow}>
              <Text style={s.insightIcon}>📊</Text>
              <View style={s.insightText}>
                <Text style={s.insightStrong}>Average monthly spend: {fmt(avgMonthly)}</Text>
                <Text style={s.insightSub}>Across {withData.length} months with data</Text>
              </View>
            </View>
            {monthTotals[highM] > 0 && (
              <View style={s.insightRow}>
                <Text style={s.insightIcon}>📈</Text>
                <View style={s.insightText}>
                  <Text style={s.insightStrong}>Highest: {MONTHS_LONG[highM]} — {fmt(monthTotals[highM])}</Text>
                  <Text style={s.insightSub}>Most expensive month of {reportYear}</Text>
                </View>
              </View>
            )}
            <View style={s.insightRow}>
              <Text style={s.insightIcon}>✅</Text>
              <View style={s.insightText}>
                <Text style={s.insightStrong}>Payment rate: {payRate}%</Text>
                <Text style={s.insightSub}>
                  {allYearBills.filter(b => b.paid).length} of {allYearBills.length} bills paid
                </Text>
              </View>
            </View>
            <View style={[s.insightRow, { flexDirection: 'column' }]}>
              <Text style={[s.insightStrong, { marginBottom: 10 }]}>
                Average monthly cost by category
              </Text>
              {catAvgs.map(({ n, avg }) => {
                const pct = Math.round((avg / maxAvg) * 100);
                return (
                  <View key={n} style={s.avgBarRow}>
                    <Text style={s.avgBarName} numberOfLines={1}>{n}</Text>
                   <MiniBar pct={pct} color="#2D3F51" height={7} />
                    <Text style={s.avgBarVal}>{fmt(avg)}/mo</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  scroll: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: '600', color: '#111', marginBottom: 14 },
  yearNav: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, justifyContent: 'space-between' },
  navBtn: { width: 38, height: 38, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  navBtnText: { fontSize: 24, color: '#6B7280' },
  yearLabel: { fontSize: 20, fontWeight: '600', color: '#111', width: 60, textAlign: 'center' },
  cmpToggle: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  cmpToggleOn: { backgroundColor: '#F9FAFB', borderColor: '#6B7280' },
  pip: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D1D5DB', marginRight: 6 },
  pipOn: { backgroundColor: '#6B7280' },
  cmpText: { fontSize: 12, color: '#6B7280' },
  cmpTextOn: { color: '#111', fontWeight: '600' },
  ig: { flexDirection: 'row', marginBottom: 8 },
  ic: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, marginRight: 8, alignItems: 'center' },
  icLabel: { fontSize: 10, color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 4, textAlign: 'center' },
  icVal: { fontSize: 18, fontWeight: '600', color: '#111', textAlign: 'center' },
  icSub: { fontSize: 11, color: '#9CA3AF', marginTop: 2, textAlign: 'center' },
  sectionTitle: { fontSize: 11, fontWeight: '600', color: '#9CA3AF', letterSpacing: 0.7, marginBottom: 10 },
  mrow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: 10, borderRadius: 8, marginBottom: 2 },
  mrowCur: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB' },
  mrowLabel: { fontSize: 13, color: '#111', width: 30 },
  mrowBars: { flex: 1, marginHorizontal: 6 },
  barLine: { flexDirection: 'row', alignItems: 'center' },
  barYearLabel: { fontSize: 9, color: '#6B7280', width: 28, textAlign: 'right', marginRight: 4 },
  mrowAmt: { fontSize: 12, fontWeight: '500', color: '#111', width: 60, textAlign: 'right' },
  ccatRow: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, marginBottom: 6 },
  ccatRowOpen: { borderColor: '#6B7280' },
  ccatHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#F9FAFB', borderRadius: 12 },
  ccatName: { flex: 1, fontSize: 14, fontWeight: '500', color: '#111' },
  ccatTotal: { fontSize: 14, fontWeight: '500', color: '#111', marginRight: 4 },
  chevron: { fontSize: 10, color: '#9CA3AF', marginLeft: 4 },
  ccatBody: { padding: 12 },
  ccatStats: { flexDirection: 'row', marginBottom: 12 },
  ccatStat: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 8, padding: 8, marginRight: 6 },
  ccatStatLabel: { fontSize: 9, color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 3 },
  ccatStatVal: { fontSize: 13, fontWeight: '600', color: '#111' },
  ccatStatSub: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  ccatMrow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  ccatMrowLabel: { fontSize: 12, color: '#6B7280', width: 28 },
  ccatMrowAmt: { fontSize: 12, fontWeight: '500', color: '#111', width: 52, textAlign: 'right' },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, backgroundColor: '#F9FAFB', borderRadius: 10, marginBottom: 6 },
  insightIcon: { fontSize: 20, marginRight: 10 },
  insightText: { flex: 1 },
  insightStrong: { fontSize: 13, fontWeight: '500', color: '#111', marginBottom: 2 },
  insightSub: { fontSize: 12, color: '#6B7280' },
  avgBarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  avgBarName: { fontSize: 12, color: '#111', width: 75, marginRight: 8 },
  avgBarVal: { fontSize: 12, color: '#6B7280', width: 72, textAlign: 'right', marginLeft: 8 },
  empty: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingVertical: 24 },
});