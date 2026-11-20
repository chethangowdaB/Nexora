# NEXORA – Android reminder app

This is a complete Expo / React Native project based on your uploaded `App.js`.
It includes the missing `parser.js` implementation and the Expo configuration.

## Run it on your Android phone (quick preview)

1. Install **Node.js LTS** on a computer.
2. Extract this ZIP and open a terminal in the `NEXORA` folder.
3. Run:

   ```bash
   npm install
   npx expo install --fix
   npx expo start
   ```

4. Install **Expo Go** on your Android phone and scan the QR code.
   Note: speech recognition, Android alarm intents and some notification behavior
   require a development/native build; Expo Go may not support every feature.

## Build an installable Android APK

For the native features in this app, use an EAS development/preview build:

```bash
npm install
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview
```

The generated APK can be downloaded from the build page and installed on your phone.
The `eas.json` preview profile is configured to produce an APK.

## Included features

- Natural-language reminder input and sample prompts
- Voice input (English - India)
- One-time scheduled notifications
- Daily repeating notifications
- Android system alarm handoff for one-time alarm reminders
- Local persistence with AsyncStorage
- Upcoming reminder list and delete action

## Important notes

- Android will ask for microphone and notification permissions.
- Exact alarm delivery can depend on Android version and device battery settings.
- Daily reminders currently repeat at the same local time each day.
- The parser supports times, today/tomorrow, weekdays, and daily repetition.
- This project source is provided; an APK has not been built or signed in this environment.
