import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import { useAccount } from '../store/AccountContext';
import { colors, radius } from '../theme';

export default function AuthenticationScreen({ navigation }: any) {
  const { signIn, register, sendPhoneOtp, verifyPhoneOtp } = useAccount();
  const [creating, setCreating] = useState(false);
  const [method, setMethod] = useState<'email' | 'phone'>('email');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (method === 'phone') {
      const normalizedPhone = phone.trim().replace(/[\s()-]/g, '');
      if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
        Alert.alert('Check your phone number', 'Enter a valid international number beginning with + and its country code, such as +255712345678.');
        return;
      }
      if (creating && !name.trim()) {
        Alert.alert('Add your name', 'Enter the name you would like shown on your account.');
        return;
      }
      if (codeSent && !/^\d{6}$/.test(code.trim())) {
        Alert.alert('Check your code', 'Enter the six-digit code sent by SMS.');
        return;
      }
      setBusy(true);
      try {
        if (!codeSent) {
          await sendPhoneOtp(normalizedPhone, creating ? name : undefined);
          setCodeSent(true);
          Alert.alert('Check your messages', 'We sent you a sign-in code by SMS.');
        } else {
          await verifyPhoneOtp(normalizedPhone, code.trim());
          navigation.goBack();
        }
      } catch (error) {
        Alert.alert(codeSent ? 'Could not verify code' : 'Could not send code', error instanceof Error ? error.message : 'Please try again.');
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!email.trim() || !password) {
      Alert.alert('Missing details', 'Enter your email and password to continue.');
      return;
    }
    if (creating && !name.trim()) {
      Alert.alert('Add your name', 'Enter the name you would like shown on your account.');
      return;
    }
    setBusy(true);
    try {
      if (creating) {
        const confirmationRequired = await register(email.trim(), password, name);
        if (confirmationRequired) {
          Alert.alert('Check your email', 'Follow the confirmation link to finish creating your Saplaya account.');
          return;
        }
      } else {
        await signIn(email.trim(), password);
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert(creating ? 'Could not create account' : 'Could not sign in', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader title={creating ? 'Create account' : 'Sign in'} onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.icon}><Ionicons name="person-circle-outline" size={44} color={colors.green} /></View>
          <Text style={styles.heading}>{creating ? 'Make Saplaya yours' : 'Welcome back'}</Text>
          <Text style={styles.subheading}>
            {creating ? 'Save your profile, delivery addresses and order history.' : 'Sign in to see your saved details and orders.'}
          </Text>

          <View style={styles.methods}>
            {(['email', 'phone'] as const).map((value) => (
              <Pressable key={value} style={[styles.method, method === value && styles.methodActive]} onPress={() => { setMethod(value); setCodeSent(false); setCode(''); }}>
                <Text style={[styles.methodText, method === value && styles.methodTextActive]}>{value === 'email' ? 'Email' : 'SMS code'}</Text>
              </Pressable>
            ))}
          </View>
          {method === 'email' ? (
            <>
              {creating && <Field label="Full name" value={name} onChangeText={setName} autoComplete="name" />}
              <Field label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
              <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete={creating ? 'new-password' : 'current-password'} />
            </>
          ) : (
            <>
              {creating && !codeSent && <Field label="Full name" value={name} onChangeText={setName} autoComplete="name" />}
              <Field label="Phone number (include country code)" value={phone} onChangeText={(value) => { setPhone(value); setCodeSent(false); }} keyboardType="phone-pad" autoComplete="tel" editable={!codeSent} placeholder="+255 7XX XXX XXX" />
              {codeSent && <Field label="Six-digit SMS code" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} />}
            </>
          )}
          <Pressable style={[styles.button, busy && { opacity: 0.65 }]} onPress={submit} disabled={busy}>
            <Text style={styles.buttonText}>{busy ? 'Please wait…' : method === 'phone' ? codeSent ? 'Verify code' : 'Send SMS code' : creating ? 'Create account' : 'Sign in'}</Text>
          </Pressable>
          {method === 'email' && (
            <Pressable style={styles.switch} onPress={() => setCreating((value) => !value)}>
              <Text style={styles.switchText}>
                {creating ? 'Already have an account? Sign in' : 'New to Saplaya? Create an account'}
              </Text>
            </Pressable>
          )}
          <Text style={styles.privacy}>Sign-in codes, email confirmation and passwords are handled securely by Supabase Authentication.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...props} style={styles.input} placeholderTextColor={colors.muted} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 22, paddingTop: 34 },
  icon: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' },
  heading: { marginTop: 20, fontSize: 28, color: colors.ink, fontWeight: '900' },
  subheading: { marginTop: 6, marginBottom: 24, fontSize: 15, lineHeight: 22, color: colors.muted },
  fieldWrap: { marginBottom: 14 },
  label: { marginBottom: 6, fontSize: 13, fontWeight: '800', color: colors.ink },
  input: { minHeight: 52, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.white, color: colors.ink, fontSize: 16 },
  button: { height: 56, marginTop: 8, borderRadius: radius.md, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: colors.white, fontWeight: '900', fontSize: 17 },
  switch: { paddingVertical: 18, alignItems: 'center' },
  switchText: { color: colors.green, fontWeight: '800', fontSize: 15 },
  methods: { flexDirection: 'row', padding: 4, marginBottom: 16, borderRadius: radius.md, backgroundColor: '#E8F5E9' },
  method: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  methodActive: { backgroundColor: colors.white },
  methodText: { color: colors.muted, fontWeight: '800' },
  methodTextActive: { color: colors.green },
  privacy: { textAlign: 'center', color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 8 },
});
