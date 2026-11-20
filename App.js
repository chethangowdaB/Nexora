import React, { useState, useEffect, useMemo } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Platform, SafeAreaView, KeyboardAvoidingView
} from "react-native";
import * as Notifications from "expo-notifications";
import * as IntentLauncher from "expo-intent-launcher";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { parseReminder, planReminder } from "./parser";

const KEY = "nexora_events_v2";
const CHANNEL = "nexora-reminders";
const CHIPS = ["school wake up at 10:45", "tomorrow at 7 pm call mom", "every day at 6:30 am gym"];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false
  })
});

const fmt = (d) =>
  new Date(d).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default function App() {
  const [text, setText] = useState("");
  const [events, setEvents] = useState([]);
  const [listening, setListening] = useState(false);
  const preview = useMemo(() => (text.trim() ? parseReminder(text) : null), [text]);

  useEffect(() => {
    (async () => {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync(CHANNEL, {
          name: "NEXORA Reminders", importance: Notifications.AndroidImportance.MAX, sound: "default"
        });
      }
      try {
        const saved = JSON.parse((await AsyncStorage.getItem(KEY)) || "[]");
        const live = saved.filter((e) => e.repeat || new Date(e.fireAt) > new Date());
        setEvents(live.sort((a, b) => new Date(a.fireAt) - new Date(b.fireAt)));
      } catch { setEvents([]); }
    })();
  }, []);

  useSpeechRecognitionEvent("start", () => setListening(true));
  useSpeechRecognitionEvent("end", () => setListening(false));
  useSpeechRecognitionEvent("result", (e) => {
    const w = e.results?.[0]?.transcript;
    if (w) setText(w);
  });
  useSpeechRecognitionEvent("error", (e) => {
    setListening(false);
    Alert.alert("Voice error", e.message || e.error);
  });

  async function toggleVoice() {
    if (listening) return ExpoSpeechRecognitionModule.stop();
    try {
      const p = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!p.granted) return Alert.alert("Microphone needed", "Allow microphone access to use voice.");
      ExpoSpeechRecognitionModule.start({ lang: "en-IN", interimResults: true, continuous: false });
    } catch { Alert.alert("Error", "Voice recognition could not start."); }
  }

  async function save(list) {
    const sorted = [...list].sort((a, b) => new Date(a.fireAt) - new Date(b.fireAt));
    setEvents(sorted);
    await AsyncStorage.setItem(KEY, JSON.stringify(sorted));
  }

  async function createReminder() {
    const now = new Date();
    const p = parseReminder(text, now);
    if (!p.ok) return Alert.alert("Couldn't understand that", p.error);
    const plan = planReminder(p, now);

    const perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return Alert.alert("Notifications off", "Allow notifications in Settings first.");

    try {
      const trigger = p.repeat
        ? { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: p.at.getHours(), minute: p.at.getMinutes(), channelId: CHANNEL }
        : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: plan.fireAt, channelId: CHANNEL };

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: p.kind === "alarm" ? `Alarm: ${p.title}` : p.title,
          body: p.hasTime ? `It's time: ${p.title}` : `${p.title} is on ${p.at.toDateString()}. Open NEXORA to get ready.`,
          sound: "default",
          interruptionLevel: "timeSensitive"
        },
        trigger
      });

      let systemAlarm = false;
      if (p.kind === "alarm" && !p.repeat && Platform.OS === "android") {
        try {
          await IntentLauncher.startActivityAsync("android.intent.action.SET_ALARM", {
            extra: {
              "android.intent.extra.alarm.HOUR": p.at.getHours(),
              "android.intent.extra.alarm.MINUTES": p.at.getMinutes(),
              "android.intent.extra.alarm.MESSAGE": p.title,
              "android.intent.extra.alarm.SKIP_UI": true
            }
          });
          systemAlarm = true;
        } catch { /* falls back to the notification */ }
      }

      await save([...events, {
        id: Date.now().toString(), title: p.title, kind: p.kind, repeat: p.repeat,
        at: p.at.toISOString(), fireAt: plan.fireAt.toISOString(), notificationId, systemAlarm
      }]);
      setText("");
      Alert.alert("Reminder set", `${p.title}\n${fmt(plan.fireAt)}${p.repeat ? " (daily)" : ""}\n${systemAlarm ? "Phone alarm created too." : plan.note}`);
    } catch { Alert.alert("Error", "Could not create your reminder."); }
  }

  async function remove(item) {
    try { await Notifications.cancelScheduledNotificationAsync(item.notificationId); } catch {}
    await save(events.filter((e) => e.id !== item.id));
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView style={s.container} keyboardShouldPersistTaps="handled">
          <Text style={s.logo}>✦ NEXORA</Text>
          <Text style={s.tagline}>Never forget what matters.</Text>

          <View style={s.card}>
            <Text style={s.heading}>Your personal assistant</Text>
            <TouchableOpacity style={s.voice} onPress={toggleVoice}>
              <Text style={s.voiceText}>{listening ? "🎙 Listening... tap to stop" : "🎙 Speak to NEXORA"}</Text>
            </TouchableOpacity>

            <TextInput
              style={s.input}
              placeholder="Set a reminder for yourself, e.g. school wake up at 10:45"
              placeholderTextColor="#888"
              value={text}
              onChangeText={setText}
              multiline
            />

            {preview && (
              <Text style={[s.preview, !preview.ok && { color: "#FFB4B4" }]}>
                {preview.ok
                  ? `${preview.kind === "alarm" ? "⏰" : "✓"} ${preview.title} · ${fmt(preview.at)}${preview.repeat ? " · daily" : ""}`
                  : preview.error}
              </Text>
            )}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
              {CHIPS.map((c) => (
                <TouchableOpacity key={c} style={s.chip} onPress={() => setText(c)}>
                  <Text style={s.chipText}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={s.save} onPress={createReminder}>
              <Text style={s.saveText}>Create my reminder →</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.section}>My upcoming reminders</Text>
          {events.map((e) => (
            <View style={s.eventCard} key={e.id}>
              <Text style={s.eventTitle}>{e.kind === "alarm" ? "⏰ " : ""}{e.title}</Text>
              <Text style={s.eventDate}>{fmt(e.fireAt)}{e.repeat ? " · every day" : ""}{e.systemAlarm ? " · phone alarm" : ""}</Text>
              <TouchableOpacity onPress={() => remove(e)}><Text style={s.delete}>Delete reminder</Text></TouchableOpacity>
            </View>
          ))}
          {events.length === 0 && <Text style={s.empty}>No reminders yet. Add your first one!</Text>}
          <Text style={s.footer}>NEXORA • Your time matters.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B1020" },
  container: { flex: 1, padding: 20 },
  logo: { color: "#70B7FF", fontSize: 34, fontWeight: "bold", marginTop: 16 },
  tagline: { color: "#AAB8D0", marginBottom: 25 },
  card: { backgroundColor: "#17243C", padding: 20, borderRadius: 20 },
  heading: { color: "white", fontSize: 22, fontWeight: "bold" },
  voice: { backgroundColor: "#315F9C", padding: 17, borderRadius: 12, marginTop: 18, alignItems: "center" },
  voiceText: { color: "white", fontWeight: "bold" },
  input: { backgroundColor: "#FFF", color: "#111827", padding: 15, borderRadius: 12, marginTop: 16, minHeight: 85 },
  preview: { color: "#9FE1CB", marginTop: 10 },
  chip: { backgroundColor: "#22345A", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, marginRight: 8 },
  chipText: { color: "#B6C4DA", fontSize: 13 },
  save: { backgroundColor: "#70B7FF", padding: 17, borderRadius: 12, marginTop: 18, alignItems: "center" },
  saveText: { color: "#081426", fontWeight: "bold", fontSize: 16 },
  section: { color: "white", fontSize: 22, fontWeight: "bold", marginTop: 30, marginBottom: 15 },
  eventCard: { backgroundColor: "#17243C", padding: 17, borderRadius: 15, marginBottom: 12 },
  eventTitle: { color: "white", fontWeight: "bold", fontSize: 18 },
  eventDate: { color: "#B6C4DA", marginTop: 8 },
  delete: { color: "#FF8585", marginTop: 14 },
  empty: { color: "#AAB8D0" },
  footer: { color: "#70819D", textAlign: "center", marginVertical: 35 }
});
