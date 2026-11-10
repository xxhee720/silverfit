import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { client } from "../../lib/client";
import {
  Button,
  Card,
  Choice,
  Field,
  Screen,
  styles,
} from "../../components/ui";
import { roles } from "../../../../lib/domain";
export default function Auth() {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [role, setRole] = useState<keyof typeof roles>("self"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      if (!email.includes("@")) throw Error("이메일을 확인해 주세요.");
      if (mode === "forgot") {
        const { error } = await client.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: "silverfit://auth/callback?type=recovery" },
        );
        if (error) throw error;
        setMessage(
          "등록된 주소라면 비밀번호 복구 메일이 발송됩니다. 이 휴대폰에서 열어 주세요.",
        );
        return;
      }
      if (mode === "signup") {
        if (password.length < 12 || !name.trim())
          throw Error("이름과 12자 이상의 비밀번호를 입력해 주세요.");
        const { error } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { name: name.trim(), role },
            emailRedirectTo: "silverfit://auth/callback?type=signup",
          },
        });
        if (error) throw error;
        setPassword("");
        setMessage(
          "가입 확인 메일을 이 휴대폰에서 열어 주세요. 기본 메일 서버는 조직 멤버 주소로 발송이 제한될 수 있습니다.",
        );
        return;
      }
      const { error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error)
        throw Error("이메일·비밀번호와 이메일 인증 여부를 확인해 주세요.");
      router.replace("/");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "처리하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      title={
        mode === "login"
          ? "다시 만나 반가워요"
          : mode === "signup"
            ? "함께 시작해요"
            : "비밀번호 찾기"
      }
    >
      <View style={styles.row}>
        {(
          [
            ["login", "로그인"],
            ["signup", "회원가입"],
            ["forgot", "비밀번호 찾기"],
          ] as const
        ).map(([k, l]) => (
          <Choice
            key={k}
            selected={mode === k}
            label={l}
            onPress={() => {
              setMode(k);
              setPassword("");
              setMessage("");
            }}
          />
        ))}
      </View>
      <Card>
        {mode === "signup" && (
          <>
            <Field
              label="이름"
              value={name}
              onChangeText={setName}
              maxLength={60}
            />
            <Text style={styles.label}>주로 누구를 위해 신청하시나요?</Text>
            <View style={styles.row}>
              {Object.entries(roles).map(([k, l]) => (
                <Choice
                  key={k}
                  label={l}
                  selected={role === k}
                  onPress={() => setRole(k as keyof typeof roles)}
                />
              ))}
            </View>
          </>
        )}
        <Field
          label="이메일"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
        {mode !== "forgot" && (
          <Field
            label="비밀번호"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
          />
        )}
        <Button
          title={
            mode === "login"
              ? "로그인"
              : mode === "signup"
                ? "회원가입"
                : "복구 메일 받기"
          }
          busy={busy}
          onPress={() => void submit()}
        />
        {message && (
          <Text accessibilityRole="alert" style={styles.text}>
            {message}
          </Text>
        )}
      </Card>
    </Screen>
  );
}
