/**
 * THROWAWAY PROTOTYPE — delete after choosing a direction.
 *
 * Three bold placements for living sumi-e artwork on Kaji's Summary screen,
 * switchable with `?prototype=growth&variant=A|B|C`. The transaction button
 * changes in-memory demo state only; none of this touches the persisted store.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const artwork = require('../assets/prototype/sumi-sakura-cat.png');

const DARK = '#0E1116';
const CARD = '#171B22';
const INK = '#EAEEF3';
const MUTED = '#9AA4B2';
const DIM = '#6B7480';
const GREEN = '#2BD48A';
const RED = '#F0766C';
const PAPER = '#F1E5D0';
const PAPER_INK = '#241B18';
const CORAL = '#CF665A';
const MONO = Platform.select({
  web: "'JetBrains Mono', ui-monospace, monospace",
  default: 'JetBrainsMono_600SemiBold',
});

const variants = [
  { key: 'A', name: '絵巻 · Cinematic hero' },
  { key: 'B', name: '和紙 · Living scroll' },
  { key: 'C', name: '花見 · Entry ceremony' },
] as const;

type VariantKey = (typeof variants)[number]['key'];

function readVariant(): VariantKey {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 'A';
  const value = new URLSearchParams(window.location.search).get('variant');
  return value === 'B' || value === 'C' ? value : 'A';
}

export function SummaryGrowthPrototype() {
  const [variant, setVariant] = useState<VariantKey>(readVariant);
  const [entries, setEntries] = useState(7);
  const [event, setEvent] = useState(0);

  const chooseVariant = (next: VariantKey) => {
    setVariant(next);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('prototype', 'growth');
      url.searchParams.set('variant', next);
      window.history.replaceState({}, '', url);
    }
  };

  const cycle = (direction: -1 | 1) => {
    const index = variants.findIndex((item) => item.key === variant);
    chooseVariant(variants[(index + direction + variants.length) % variants.length].key);
  };

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (keyboardEvent: KeyboardEvent) => {
      const target = keyboardEvent.target as HTMLElement | null;
      if (target?.matches('input, textarea, [contenteditable="true"]')) return;
      if (keyboardEvent.key === 'ArrowLeft') cycle(-1);
      if (keyboardEvent.key === 'ArrowRight') cycle(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [variant]);

  const addEntry = () => {
    setEntries((count) => Math.min(count + 1, 24));
    setEvent((value) => value + 1);
  };

  return (
    <View style={styles.root}>
      {variant === 'A' && <CinematicHero entries={entries} event={event} onAdd={addEntry} />}
      {variant === 'B' && <LivingScroll entries={entries} event={event} onAdd={addEntry} />}
      {variant === 'C' && <EntryCeremony entries={entries} event={event} onAdd={addEntry} />}
      <PrototypeSwitcher variant={variant} onCycle={cycle} />
    </View>
  );
}

function CinematicHero({ entries, event, onAdd }: DemoProps) {
  const drift = useLoop(10500);
  const response = useResponse(event, 1500);

  return (
    <View style={styles.darkScreen}>
      <View style={styles.heroCrop}>
        <Animated.Image
          source={artwork}
          resizeMode="cover"
          style={[
            styles.heroImage,
            {
              transform: [
                { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1.04, 1.12] }) },
                { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-5, 7] }) },
                { translateY: response.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) },
              ],
            },
          ]}
        />
        <View style={styles.heroShade} />
        <PetalBurst progress={response} />
        <View style={styles.heroTopbar}>
          <View>
            <Text style={styles.heroKicker}>家計 · JULY 2026</Text>
            <Text style={styles.heroTitle}>A month in bloom.</Text>
          </View>
          <View style={styles.darkGear}><Text style={styles.gearText}>⚙</Text></View>
        </View>
        <View style={styles.heroProgress}>
          <Text style={styles.heroProgressNumber}>{entries}</Text>
          <Text style={styles.heroProgressCopy}>moments recorded{`\n`}this month</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.heroContent} showsVerticalScrollIndicator={false}>
        <SummaryCard dark />
        <CategoryRows dark />
        <DemoButton onAdd={onAdd} dark label="Record another moment" />
      </ScrollView>
    </View>
  );
}

function LivingScroll({ entries, event, onAdd }: DemoProps) {
  const drift = useLoop(12000);
  const response = useResponse(event, 1700);
  const revealHeight = Math.min(300 + entries * 8, 444);

  return (
    <View style={styles.paperScreen}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.paperHeader}>
          <View>
            <Text style={styles.paperMark}>家 計</Text>
            <Text style={styles.paperDate}>JULY · 令和八年</Text>
          </View>
          <Text style={styles.paperSeal}>記{`\n`}録</Text>
        </View>

        <Animated.View style={[styles.scrollArtwork, { height: revealHeight }]}>
          <Animated.Image
            source={artwork}
            resizeMode="cover"
            style={[
              styles.scrollImage,
              {
                opacity: response.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }),
                transform: [
                  { scale: response.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] }) },
                  { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [-5, 5] }) },
                ],
              },
            ]}
          />
          <View style={styles.scrollFade} />
          <PetalBurst progress={response} />
          <View style={styles.scrollCaption}>
            <Text style={styles.scrollCount}>{entries}</Text>
            <View>
              <Text style={styles.scrollCaptionTitle}>記録が景色になる</Text>
              <Text style={styles.scrollCaptionCopy}>Your records become the landscape.</Text>
            </View>
          </View>
        </Animated.View>

        <View style={styles.paperSummary}>
          <Text style={styles.paperEyebrow}>今 月 の 残 り</Text>
          <Text style={styles.paperNet}>¥26,070</Text>
          <View style={styles.paperRule} />
          <View style={styles.paperStats}>
            <PaperStat label="INCOME" value="¥120,000" />
            <PaperStat label="SPENT" value="¥43,930" />
            <PaperStat label="PACE" value="ON TRACK" />
          </View>
        </View>

        <DemoButton onAdd={onAdd} dark={false} label="一筆加える · Add an entry" />
      </ScrollView>
    </View>
  );
}

function EntryCeremony({ entries, event, onAdd }: DemoProps) {
  const response = useResponse(event, 2400);
  const drift = useLoop(11000);

  return (
    <View style={styles.darkScreen}>
      <ScrollView contentContainerStyle={styles.ceremonyContent} showsVerticalScrollIndicator={false}>
        <View style={styles.standardHeader}>
          <View><Text style={styles.standardTitle}>Summary</Text><Text style={styles.standardSubtitle}>July 2026</Text></View>
          <View style={styles.darkGear}><Text style={styles.gearText}>⚙</Text></View>
        </View>
        <SummaryCard dark />
        <CategoryRows dark />
        <View style={styles.ceremonyPrompt}>
          <Text style={styles.ceremonyPromptTitle}>The garden is waiting.</Text>
          <Text style={styles.ceremonyPromptCopy}>{entries} entries have shaped this month’s scene.</Text>
        </View>
        <DemoButton onAdd={onAdd} dark label="Record transaction · preview ceremony" />
      </ScrollView>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.ceremonyOverlay,
          {
            opacity: response.interpolate({
              inputRange: [0, 0.06, 0.78, 1],
              outputRange: [0, 1, 1, 0],
            }),
          },
        ]}
      >
        <Animated.Image
          source={artwork}
          resizeMode="cover"
          style={[
            styles.ceremonyImage,
            {
              transform: [
                { scale: response.interpolate({ inputRange: [0, 1], outputRange: [1.18, 1.02] }) },
                { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [-4, 4] }) },
              ],
            },
          ]}
        />
        <View style={styles.ceremonyVignette} />
        <PetalBurst progress={response} strong />
        <Animated.View
          style={[
            styles.ceremonyMessage,
            {
              opacity: response.interpolate({ inputRange: [0, 0.18, 0.82, 1], outputRange: [0, 1, 1, 0] }),
              transform: [{ translateY: response.interpolate({ inputRange: [0, 0.3, 1], outputRange: [24, 0, -8] }) }],
            },
          ]}
        >
          <Text style={styles.ceremonyJapanese}>一日 一筆</Text>
          <Text style={styles.ceremonyMessageTitle}>The garden remembers.</Text>
          <Text style={styles.ceremonyMessageCopy}>ENTRY {String(entries).padStart(2, '0')} · JULY</Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

interface DemoProps {
  entries: number;
  event: number;
  onAdd: () => void;
}

function PetalBurst({ progress, strong = false }: { progress: Animated.Value; strong?: boolean }) {
  const petals = [
    [5, 18, -40, 160], [13, 62, 28, 210], [24, 32, -18, 190], [36, 78, 35, 150],
    [46, 12, -35, 230], [57, 54, 24, 180], [67, 25, -22, 220], [76, 72, 34, 170],
    [84, 38, -26, 205], [92, 15, 18, 155], [31, 8, 30, 240], [63, 84, -32, 185],
  ];
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {petals.map(([left, top, x, y], index) => (
        <Animated.View
          key={`${left}-${top}`}
          style={[
            styles.petal,
            {
              left: `${left}%`,
              top: `${top}%`,
              width: strong ? 11 + (index % 3) * 4 : 8 + (index % 3) * 3,
              height: strong ? 7 + (index % 2) * 3 : 5 + (index % 2) * 2,
              opacity: progress.interpolate({ inputRange: [0, 0.12, 0.8, 1], outputRange: [0, 0.9, 0.7, 0] }),
              transform: [
                { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, x] }) },
                { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, y] }) },
                { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${index % 2 ? 260 : -220}deg`] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

function SummaryCard({ dark }: { dark: boolean }) {
  return (
    <View style={[styles.summaryCard, !dark && styles.summaryCardPaper]}>
      <Text style={[styles.eyebrow, !dark && styles.paperTextMuted]}>NET THIS MONTH</Text>
      <Text style={[styles.net, !dark && styles.paperText]}>+¥76,070</Text>
      <View style={styles.splitTrack}><View style={styles.splitIn} /><View style={styles.splitOut} /></View>
      <View style={styles.legendRow}>
        <Legend color={GREEN} label="In" value="¥120,000" dark={dark} />
        <Legend color={RED} label="Out" value="¥43,930" dark={dark} />
      </View>
      <View style={[styles.budgetRow, !dark && styles.paperBorder]}>
        <Text style={[styles.muted, !dark && styles.paperTextMuted]}>Budget left</Text>
        <Text style={[styles.amount, !dark && styles.paperText]}>¥26,070</Text>
      </View>
    </View>
  );
}

function CategoryRows({ dark }: { dark: boolean }) {
  return (
    <View style={styles.categories}>
      <Text style={[styles.eyebrow, !dark && styles.paperTextMuted]}>SPENDING BY CATEGORY</Text>
      <Category label="Groceries" amount="¥12,830" width="86%" dark={dark} />
      <Category label="Food" amount="¥10,600" width="71%" dark={dark} />
      <Category label="Bills" amount="¥7,600" width="51%" dark={dark} />
    </View>
  );
}

function DemoButton({ onAdd, dark, label }: { onAdd: () => void; dark: boolean; label: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={onAdd} style={[styles.addButton, !dark && styles.paperButton]}>
      <Text style={[styles.addText, !dark && styles.paperButtonText]}>＋ {label}</Text>
    </Pressable>
  );
}

function Legend({ color, label, value, dark }: { color: string; label: string; value: string; dark: boolean }) {
  return (
    <View style={styles.legend}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.muted, !dark && styles.paperTextMuted]}>{label}</Text>
      <Text style={[styles.amount, { color }]}>{value}</Text>
    </View>
  );
}

function Category({ label, amount, width, dark }: { label: string; amount: string; width: `${number}%`; dark: boolean }) {
  return (
    <View style={styles.category}>
      <View style={styles.categoryRow}>
        <Text style={[styles.categoryLabel, !dark && styles.paperText]}>{label}</Text>
        <Text style={[styles.amount, !dark && styles.paperText]}>{amount}</Text>
      </View>
      <View style={[styles.categoryTrack, !dark && styles.paperTrack]}><View style={[styles.categoryFill, { width }]} /></View>
    </View>
  );
}

function PaperStat({ label, value }: { label: string; value: string }) {
  return <View><Text style={styles.paperStatLabel}>{label}</Text><Text style={styles.paperStatValue}>{value}</Text></View>;
}

function useLoop(duration: number) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(value, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(value, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [duration, value]);
  return value;
}

function useResponse(event: number, duration: number) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (event === 0) return;
    value.stopAnimation();
    value.setValue(0);
    Animated.timing(value, { toValue: 1, duration, easing: Easing.inOut(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
  }, [duration, event, value]);
  return value;
}

function PrototypeSwitcher({ variant, onCycle }: { variant: VariantKey; onCycle: (direction: -1 | 1) => void }) {
  if (process.env.NODE_ENV === 'production') return null;
  const item = variants.find((candidate) => candidate.key === variant)!;
  return (
    <View style={styles.switcher}>
      <Pressable accessibilityLabel="Previous variant" onPress={() => onCycle(-1)} style={styles.switchArrow}><Text style={styles.switchText}>←</Text></Pressable>
      <Text style={styles.switchLabel}>{item.key} — {item.name}</Text>
      <Pressable accessibilityLabel="Next variant" onPress={() => onCycle(1)} style={styles.switchArrow}><Text style={styles.switchText}>→</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DARK, overflow: 'hidden' },
  darkScreen: { flex: 1, backgroundColor: DARK },
  heroCrop: { height: 390, overflow: 'hidden', backgroundColor: PAPER },
  heroImage: { position: 'absolute', width: '108%', height: '112%', left: '-4%', top: '-5%' },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10,8,6,.20)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,.14)' },
  heroTopbar: { position: 'absolute', top: 20, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroKicker: { color: 'rgba(255,255,255,.88)', fontFamily: MONO, fontSize: 9.5, fontWeight: '700', letterSpacing: 1.4, textShadowColor: 'rgba(0,0,0,.65)', textShadowRadius: 5 },
  heroTitle: { color: '#FFF9EF', marginTop: 6, fontFamily: Platform.OS === 'web' ? 'Georgia, serif' : undefined, fontSize: 30, letterSpacing: -0.6, textShadowColor: 'rgba(0,0,0,.72)', textShadowRadius: 8 },
  darkGear: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(14,17,22,.78)', alignItems: 'center', justifyContent: 'center' },
  gearText: { color: INK, fontSize: 15 },
  heroProgress: { position: 'absolute', left: 20, bottom: 30, flexDirection: 'row', alignItems: 'center', gap: 11 },
  heroProgressNumber: { color: '#FFF9EF', fontFamily: Platform.OS === 'web' ? 'Georgia, serif' : MONO, fontSize: 58, lineHeight: 60, textShadowColor: 'rgba(0,0,0,.7)', textShadowRadius: 8 },
  heroProgressCopy: { color: 'rgba(255,249,239,.92)', fontSize: 11, fontWeight: '700', lineHeight: 15, textShadowColor: 'rgba(0,0,0,.8)', textShadowRadius: 5 },
  heroContent: { marginTop: -18, paddingHorizontal: 20, paddingBottom: 128 },

  paperScreen: { flex: 1, backgroundColor: PAPER },
  scrollContent: { paddingBottom: 122 },
  paperHeader: { height: 88, paddingHorizontal: 22, paddingTop: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  paperMark: { color: PAPER_INK, fontFamily: Platform.OS === 'web' ? 'Georgia, serif' : undefined, fontSize: 24, letterSpacing: 8 },
  paperDate: { color: 'rgba(36,27,24,.58)', fontFamily: MONO, fontSize: 8.5, marginTop: 4, letterSpacing: 1.5 },
  paperSeal: { color: '#FFF2DF', backgroundColor: CORAL, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 5, fontSize: 10, lineHeight: 12, textAlign: 'center' },
  scrollArtwork: { marginHorizontal: 12, overflow: 'hidden', borderRadius: 2, backgroundColor: '#E9D9BF', shadowColor: '#4C3427', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 7 } },
  scrollImage: { position: 'absolute', width: '100%', height: 520, top: -34 },
  scrollFade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(82,44,30,.04)' },
  scrollCaption: { position: 'absolute', left: 18, right: 18, bottom: 18, minHeight: 72, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: 'rgba(245,235,216,.90)', borderLeftWidth: 3, borderLeftColor: CORAL, flexDirection: 'row', alignItems: 'center', gap: 13 },
  scrollCount: { color: PAPER_INK, fontFamily: Platform.OS === 'web' ? 'Georgia, serif' : MONO, fontSize: 42 },
  scrollCaptionTitle: { color: PAPER_INK, fontSize: 13, fontWeight: '700', marginBottom: 3 },
  scrollCaptionCopy: { color: 'rgba(36,27,24,.62)', fontSize: 9.5 },
  paperSummary: { margin: 20, paddingTop: 5 },
  paperEyebrow: { color: CORAL, fontSize: 10, fontWeight: '700', letterSpacing: 4 },
  paperNet: { color: PAPER_INK, fontFamily: Platform.OS === 'web' ? 'Georgia, serif' : MONO, fontSize: 44, marginTop: 6 },
  paperRule: { height: 1, backgroundColor: 'rgba(36,27,24,.20)', marginVertical: 14 },
  paperStats: { flexDirection: 'row', justifyContent: 'space-between' },
  paperStatLabel: { color: 'rgba(36,27,24,.46)', fontFamily: MONO, fontSize: 8, letterSpacing: 1 },
  paperStatValue: { color: PAPER_INK, fontFamily: MONO, fontSize: 10.5, marginTop: 4 },

  ceremonyContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 128 },
  standardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  standardTitle: { color: INK, fontSize: 24, fontWeight: '700' },
  standardSubtitle: { color: MUTED, fontSize: 12, marginTop: 2 },
  ceremonyPrompt: { marginTop: 18, padding: 16, borderLeftWidth: 2, borderLeftColor: CORAL, backgroundColor: 'rgba(207,102,90,.07)' },
  ceremonyPromptTitle: { color: INK, fontFamily: Platform.OS === 'web' ? 'Georgia, serif' : undefined, fontSize: 19 },
  ceremonyPromptCopy: { color: MUTED, fontSize: 11, marginTop: 4 },
  ceremonyOverlay: { ...StyleSheet.absoluteFill, zIndex: 20, backgroundColor: PAPER },
  ceremonyImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  ceremonyVignette: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(22,10,8,.10)', borderWidth: 12, borderColor: 'rgba(63,35,25,.16)' },
  ceremonyMessage: { position: 'absolute', left: 24, right: 24, bottom: 94, alignItems: 'center', paddingVertical: 18, backgroundColor: 'rgba(245,235,216,.90)', borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(77,40,30,.24)' },
  ceremonyJapanese: { color: CORAL, fontSize: 11, fontWeight: '700', letterSpacing: 5, marginBottom: 7 },
  ceremonyMessageTitle: { color: PAPER_INK, fontFamily: Platform.OS === 'web' ? 'Georgia, serif' : undefined, fontSize: 29 },
  ceremonyMessageCopy: { color: 'rgba(36,27,24,.58)', fontFamily: MONO, fontSize: 8.5, letterSpacing: 2, marginTop: 7 },

  petal: { position: 'absolute', borderRadius: 8, backgroundColor: '#E8736A' },
  summaryCard: { backgroundColor: CARD, borderRadius: 18, padding: 18, gap: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,.08)' },
  summaryCardPaper: { backgroundColor: 'rgba(246,237,220,.90)', borderColor: 'rgba(36,27,24,.12)' },
  eyebrow: { color: DIM, fontFamily: MONO, fontSize: 10.5, fontWeight: '600', letterSpacing: 1.47 },
  net: { color: GREEN, fontFamily: MONO, fontSize: 40, fontWeight: '700', letterSpacing: -1.2 },
  splitTrack: { height: 8, borderRadius: 6, overflow: 'hidden', flexDirection: 'row', backgroundColor: '#242B35' },
  splitIn: { width: '73%', backgroundColor: GREEN },
  splitOut: { flex: 1, backgroundColor: RED },
  legendRow: { flexDirection: 'row', gap: 18, flexWrap: 'wrap' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  muted: { color: MUTED, fontSize: 12, fontWeight: '500' },
  amount: { color: INK, fontFamily: MONO, fontSize: 13, fontWeight: '600' },
  budgetRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,.1)', paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between' },
  categories: { marginTop: 23, gap: 15 },
  category: { gap: 8 },
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  categoryLabel: { color: INK, fontSize: 14, fontWeight: '600' },
  categoryTrack: { height: 7, borderRadius: 6, backgroundColor: '#242B35', overflow: 'hidden' },
  categoryFill: { height: '100%', backgroundColor: GREEN, borderRadius: 6 },
  paperTrack: { backgroundColor: 'rgba(36,27,24,.14)' },
  paperText: { color: PAPER_INK },
  paperTextMuted: { color: 'rgba(36,27,24,.56)' },
  paperBorder: { borderTopColor: 'rgba(36,27,24,.14)' },
  addButton: { height: 48, marginTop: 20, borderRadius: 14, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  addText: { color: '#0B0E12', fontSize: 12.5, fontWeight: '700' },
  paperButton: { marginHorizontal: 20, marginTop: 0, backgroundColor: PAPER_INK, borderRadius: 2 },
  paperButtonText: { color: '#FFF4E3', letterSpacing: 0.5 },

  switcher: { position: 'absolute', zIndex: 40, left: 24, right: 24, bottom: 18, height: 48, borderRadius: 24, backgroundColor: '#EAEEF3', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 5, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  switchArrow: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#DDE2E8', alignItems: 'center', justifyContent: 'center' },
  switchText: { color: '#141820', fontSize: 18, fontWeight: '700' },
  switchLabel: { color: '#141820', fontSize: 11, fontWeight: '700' },
});
