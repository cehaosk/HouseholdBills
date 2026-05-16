import React, { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Animated, Image, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BillsScreen from './screens/BillsScreen';
import ReportScreen from './screens/ReportScreen';
import SettingsScreen from './screens/SettingsScreen';

export default function App() {
  const [screen, setScreen] = React.useState('bills');
  const [splashDone, setSplashDone] = useState(false);
  const [navMonth, setNavMonth] = useState(null);
  const [navYear, setNavYear] = useState(null);
  const splashOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }).start(() => setSplashDone(true));
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  function navigateToBills(month, year) {
    setNavMonth(month);
    setNavYear(year);
    setScreen('bills');
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar backgroundColor="#2D3F51" barStyle="light-content" />
      <SafeAreaView style={s.safe}>
        <View style={s.content}>
          {screen === 'bills'
            ? <BillsScreen initialMonth={navMonth} initialYear={navYear} />
            : screen === 'report'
            ? <ReportScreen onNavigateToBills={navigateToBills} />
            : <SettingsScreen />}
        </View>
        <View style={s.tabBar}>
          <TouchableOpacity style={s.tab} onPress={() => { setNavMonth(null); setNavYear(null); setScreen('bills'); }}>
            <Text style={s.tabIcon}>🏠</Text>
            <Text style={[s.tabLabel, screen === 'bills' && s.tabLabelActive]}>Bills</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.tab} onPress={() => setScreen('report')}>
            <Text style={s.tabIcon}>📊</Text>
            <Text style={[s.tabLabel, screen === 'report' && s.tabLabelActive]}>Report</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.tab} onPress={() => setScreen('settings')}>
            <Text style={s.tabIcon}>⚙️</Text>
            <Text style={[s.tabLabel, screen === 'settings' && s.tabLabelActive]}>Settings</Text>
          </TouchableOpacity>
        </View>

        {!splashDone && (
          <Animated.View style={[s.splash, { opacity: splashOpacity }]}>
            <Image source={require('./assets/splash.png')} style={{ width: 200, height: 200 }} resizeMode="contain" />
          </Animated.View>
        )}

      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1 },
  tabBar: {
    flexDirection: 'row', height: 100, borderTopWidth: 1,
    borderTopColor: '#E5E7EB', backgroundColor: '#fff',
    paddingBottom: 40
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabIcon: { fontSize: 20 },
  tabLabel: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  tabLabelActive: { color: '#111', fontWeight: '600' },
  splash: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#2D3F51', alignItems: 'center', justifyContent: 'center',
    zIndex: 999
  },
  splashText: { fontSize: 42, fontWeight: '700', color: '#fff', letterSpacing: 3 },
});