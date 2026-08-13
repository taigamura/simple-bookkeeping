import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

import { type RecurrenceDate } from '../domain';
import { strings } from '../i18n';

export interface DatePickerBoundaryProps {
  value: RecurrenceDate;
  today: RecurrenceDate;
  label: string;
  onChange: (value: RecurrenceDate) => void;
  /** Kept for controlled-form compatibility; native users cannot edit the trigger. */
  onTextChange?: (text: string) => void;
}

export const formatPickerDate = ({ y, m, day }: RecurrenceDate): string =>
  `${String(y).padStart(4, '0')}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

/** Construct a local Date without Date's special handling for years 0–99. */
export const dateFromRecurrence = ({ y, m, day }: RecurrenceDate): Date => {
  const date = new Date(0);
  date.setHours(0, 0, 0, 0);
  date.setFullYear(y, m, day);
  return date;
};

export const recurrenceFromDate = (date: Date): RecurrenceDate => ({
  y: date.getFullYear(),
  m: date.getMonth(),
  day: date.getDate(),
});

function PickerActions({
  onCancel,
  onToday,
  onDone,
}: {
  onCancel: () => void;
  onToday: () => void;
  onDone: () => void;
}) {
  return (
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel={strings.common.cancel} onPress={onCancel}>
        <Text style={styles.actionText}>{strings.common.cancel}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={strings.entry.today} onPress={onToday}>
        <Text style={styles.actionText}>{strings.entry.today}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={strings.nav.done} onPress={onDone}>
        <Text style={[styles.actionText, styles.doneText]}>{strings.nav.done}</Text>
      </Pressable>
    </View>
  );
}

/**
 * Platform boundary for the entry date. Native platforms never expose a text
 * editor: iOS gets a temporary wheel and Android gets its system dialog. Web
 * uses the browser's constrained date control, which is the safest fallback
 * when no native date picker exists.
 */
export function DatePickerBoundary({ value, today, label, onChange, onTextChange }: DatePickerBoundaryProps) {
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = (date: Date) => onChange(recurrenceFromDate(date));
  const handleNativeChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'set' && date) commit(date);
  };

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: dateFromRecurrence(value),
        mode: 'date',
        minimumDate: dateFromRecurrence({ y: 1, m: 0, day: 1 }),
        maximumDate: dateFromRecurrence({ y: 9999, m: 11, day: 31 }),
        onChange: handleNativeChange,
      });
      return;
    }
    setDraft(value);
    setIosOpen(true);
  };

  if (Platform.OS === 'web') {
    return React.createElement('input', {
      type: 'date',
      value: formatPickerDate(value),
      min: '0001-01-01',
      max: '9999-12-31',
      'aria-label': label,
      onChange: (event: { currentTarget: { value: string } }) => {
        const [y, m, day] = event.currentTarget.value.split('-').map(Number);
        if (y > 0 && m >= 1 && m <= 12 && day >= 1) onChange({ y, m: m - 1, day });
      },
      style: styles.webInput,
    });
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: formatPickerDate(value) }}
        onPress={open}
        // These controlled props keep existing form harnesses able to inspect
        // the date without turning the native trigger into a text editor.
        {...({ value: formatPickerDate(value), onChangeText: onTextChange, style: styles.trigger } as object)}
        style={styles.trigger}
      >
        <Text style={styles.triggerText}>{formatPickerDate(value)}</Text>
      </Pressable>
      {Platform.OS === 'ios' && (
        <Modal visible={iosOpen} transparent animationType="slide" onRequestClose={() => setIosOpen(false)}>
          <View style={styles.backdrop}>
            <View style={styles.iosSheet}>
              <DateTimePicker
                value={dateFromRecurrence(draft)}
                mode="date"
                display="spinner"
                minimumDate={dateFromRecurrence({ y: 1, m: 0, day: 1 })}
                maximumDate={dateFromRecurrence({ y: 9999, m: 11, day: 31 })}
                onValueChange={(_, date) => setDraft(recurrenceFromDate(date))}
              />
              <PickerActions
                onCancel={() => setIosOpen(false)}
                onToday={() => setDraft(today)}
                onDone={() => {
                  onChange(draft);
                  setIosOpen(false);
                }}
              />
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, fontFamily: 'JetBrainsMono_600SemiBold' },
  triggerText: { fontFamily: 'JetBrainsMono_600SemiBold', fontSize: 16 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  iosSheet: { backgroundColor: '#fff', padding: 16 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionText: { fontSize: 16, color: '#2B33E8' },
  doneText: { fontWeight: '700' },
  webInput: { minHeight: 44, fontFamily: 'JetBrainsMono_600SemiBold', fontSize: 16, borderWidth: 0 },
});
